/**
 * The source-agnostic pipeline: clean -> dedupe -> resolve entities -> chunk -> index.
 * Everything here operates on SourceDoc / Chunk and never looks at which adapter produced a doc.
 */
import type { SourceAdapter } from "../adapters/types.js";
import type { SourceDoc, Chunk, CorpusIndex, EntityRef, DedupeReport, GapReport, Tier, IndexPerson } from "../core/types.js";
import { tokenize, jaccard, tfidfVector, detectLanguage } from "../util/text.js";
import { sha1 } from "../util/hash.js";
import { scrubPii, looksLikeParticipantData } from "./pii.js";

const NEAR_DUP_THRESHOLD = 0.82;
const QUARANTINE_BELOW = 0.6;

export interface RunOptions {
  corpusLabel: string;
  /** tiers that must never enter the index (defence in depth beyond ACLs) */
  excludeTiers?: Tier[];
  notCovered?: string[];
  log?: (msg: string) => void;
  /** git commit the build ran at — recorded in the manifest for reproducibility (§6.5) */
  commit?: string | null;
  /** learned-embedder id (e.g. "bge-small"); omit for the tf-idf default */
  embedderId?: string;
}

export async function runPipeline(adapters: SourceAdapter[], opts: RunOptions): Promise<CorpusIndex> {
  const log = opts.log ?? (() => {});
  const exclude = new Set<Tier>(opts.excludeTiers ?? ["restricted", "never-ingest"]);

  // ---------- 1. INGEST ----------
  let docs: SourceDoc[] = [];
  const perSystem: Record<string, number> = {};
  for (const a of adapters) {
    const pulled = await a.pull();
    perSystem[a.system] = pulled.length;
    log(`  ${a.label}: pulled ${pulled.length}`);
    docs.push(...pulled);
  }
  const seen = docs.length;

  // ---------- 2. CLEAN + PII PASS ----------
  let quarantined = 0;
  let piiRedactions = 0;
  let piiTierRaised = 0;
  docs = docs
    .map((d) => {
      const cleaned = clean(d.text);
      // PII redaction at intake (§6.3, security review A7): scrub direct identifiers,
      // and raise the tier when a document clearly carries named participant data.
      const pii = scrubPii(cleaned);
      const findingCount = pii.findings.reduce((s, f) => s + f.count, 0);
      piiRedactions += findingCount;
      let tier = d.tier;
      if ((pii.score >= 1.5 || looksLikeParticipantData(pii.text)) && tier !== "restricted" && tier !== "never-ingest") {
        tier = "restricted";
        piiTierRaised++;
        log(`  PII: raised ${d.id} → restricted (score ${pii.score.toFixed(1)}${looksLikeParticipantData(pii.text) ? ", participant-data pattern" : ""})`);
      } else if (findingCount) {
        log(`  PII: redacted ${findingCount} identifier(s) in ${d.id} [${pii.findings.map((f) => f.kind).join(", ")}]`);
      }
      return {
        ...d,
        text: pii.text,
        tier,
        language: d.language === "unknown" ? detectLanguage(pii.text) : d.language,
        meta: { ...d.meta, piiFindings: pii.findings },
      };
    })
    .filter((d) => {
      if (d.extractionConfidence < QUARANTINE_BELOW) {
        quarantined++;
        log(`  quarantined (low extraction confidence ${d.extractionConfidence}): ${d.id}`);
        return false;
      }
      return true;
    });

  // ---------- 3. TIER EXCLUSION (defence in depth) ----------
  // Excluded docs are dropped from the index. For `restricted` (not `never-ingest`) we keep a
  // metadata-only stub so retrieval can honestly say "matching content is restricted".
  const beforeTier = docs.length;
  const restrictedStubDocs = docs.filter((d) => d.tier === "restricted");
  docs = docs.filter((d) => !exclude.has(d.tier));
  const tierExcluded = beforeTier - docs.length;

  // ---------- 4. DEDUPE ----------
  const dedupe = dedupeDocs(docs, log);
  docs = docs.filter((d) => !dedupe.mergedInto[d.id]);

  // ---------- 5. RESOLVE ENTITIES ----------
  resolveEntities(restrictedStubDocs, () => {});
  const entities = resolveEntities(docs, log);

  // ---------- 6. CHUNK ----------
  const rawChunks = docs.flatMap(chunkDoc);

  // ---------- 7. INDEX (df, tf-idf vectors) ----------
  const df: Record<string, number> = {};
  for (const c of rawChunks) {
    for (const t of new Set(c.tokens)) df[t] = (df[t] ?? 0) + 1;
  }
  const docCount = rawChunks.length;
  const avgDocLen = rawChunks.reduce((s, c) => s + c.tokens.length, 0) / (docCount || 1);
  const chunks: Chunk[] = rawChunks.map((c) => ({ ...c, vector: tfidfVector(c.tokens, df, docCount) }));

  // metadata-only stubs for restricted docs — title + entities, no content
  for (const d of restrictedStubDocs) {
    chunks.push({
      id: `${d.id}#stub`,
      docId: d.id,
      system: d.system,
      deepLink: d.deepLink,
      docTitle: d.title,
      text: "",
      date: d.date,
      tier: "restricted",
      acl: [],
      entities: d.entities,
      tokens: tokenize(`${d.title} ${d.entities.map((e) => e.label).join(" ")}`),
      vector: {},
      restrictedStub: true,
    });
  }

  // ---------- 7b. LEARNED EMBEDDINGS (opt-in) ----------
  let embedderMeta: { id: string; dims: number } | undefined;
  if (opts.embedderId) {
    const { getEmbedder } = await import("../embed/embedder.js");
    const e = await getEmbedder(opts.embedderId);
    if (e) {
      log(`  embedding ${chunks.length} chunks with ${e.id} (${e.dims}d)…`);
      const texts = chunks.map((c) => `${c.docTitle}\n${c.text}`.slice(0, 2000));
      const vecs: number[][] = [];
      for (let i = 0; i < texts.length; i += 16) vecs.push(...(await e.embed(texts.slice(i, i + 16))));
      chunks.forEach((c, i) => (c.dense = vecs[i]));
      embedderMeta = { id: e.id, dims: e.dims };
      log(`  embeddings done`);
    } else {
      log(`  embedder "${opts.embedderId}" unavailable — using tf-idf only`);
    }
  }

  // ---------- 8. GAP REPORT + DIRECTORY ----------
  const gaps = gapReport(docs);
  const directory = buildDirectory(docs);

  const dates = docs.map((d) => d.date).filter(Boolean).sort() as string[];
  log(
    `  seen ${seen} · quarantined ${quarantined} · PII redactions ${piiRedactions} · PII tier-raised ${piiTierRaised} · ` +
      `tier-excluded ${tierExcluded} · exact dups ${dedupe.exactDuplicates} · near dups ${dedupe.nearDuplicates} · ` +
      `cross-system links ${dedupe.crossSystemLinks} · chunks ${chunks.length}`
  );

  // Build manifest — records exactly what is in the index and how it got there (§6.5).
  const contentDigest = sha1(
    chunks
      .map((c) => `${c.id}:${sha1(c.text)}`)
      .sort()
      .join("|")
  );
  const builtAt = new Date().toISOString();

  return {
    builtAt,
    corpusLabel: opts.corpusLabel,
    manifest: {
      builtAt,
      commit: opts.commit ?? null,
      sourceCounts: perSystem,
      contentDigest,
    },
    embedder: embedderMeta,
    chunks,
    df,
    docCount,
    avgDocLen,
    entities,
    directory,
    dedupe,
    gaps,
    coverage: {
      systems: adapters.map((a) => a.label),
      dateRange: dates.length ? [dates[0]!, dates[dates.length - 1]!] : null,
      notCovered: opts.notCovered ?? [],
    },
  };
}

// ---------------------------------------------------------------------------

function clean(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*(confidential|internal use only|do not distribute)\s*$/gim, "")
    .trim();
}

/** exact (content hash) + near (jaccard) + cross-system (explicit duplicate pointer or title+date match) */
function dedupeDocs(docs: SourceDoc[], log: (m: string) => void): DedupeReport {
  const mergedInto: Record<string, string> = {};
  const byHash: Record<string, string> = {};
  let exact = 0,
    near = 0,
    cross = 0;

  const tokenSets = new Map<string, Set<string>>();
  for (const d of docs) tokenSets.set(d.id, new Set(tokenize(d.text)));

  for (const d of docs) {
    if (mergedInto[d.id]) continue;
    const h = sha1(d.text.replace(/\s+/g, " ").toLowerCase());
    if (byHash[h]) {
      mergedInto[d.id] = byHash[h]!;
      exact++;
      log(`  exact duplicate: ${d.id} -> ${byHash[h]}`);
      continue;
    }
    byHash[h] = d.id;
  }

  const live = docs.filter((d) => !mergedInto[d.id]);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!,
        b = live[j]!;
      if (mergedInto[a.id] || mergedInto[b.id]) continue;

      // cross-system: an adapter told us this doc mirrors a portal upload
      const aDup = a.meta.duplicateOfPortal as string | null;
      const bDup = b.meta.duplicateOfPortal as string | null;
      const crossLink =
        (aDup && bDup && aDup === bDup) ||
        (aDup && b.sourceId.includes(aDup)) ||
        (bDup && a.sourceId.includes(bDup)) ||
        (a.system !== b.system && a.meta.grantId && a.meta.grantId === b.meta.grantId && sameishTitle(a.title, b.title));

      const sim = jaccard(tokenSets.get(a.id)!, tokenSets.get(b.id)!);

      if (crossLink || sim >= NEAR_DUP_THRESHOLD) {
        // keep the authoritative copy: structured GivingData record > Drive; higher extraction confidence; newer
        const [keep, drop] = pickAuthoritative(a, b);
        mergedInto[drop.id] = keep.id;
        if (crossLink && a.system !== b.system) {
          cross++;
          log(`  cross-system duplicate: ${drop.id} -> ${keep.id} (authoritative)`);
        } else {
          near++;
          log(`  near duplicate (${sim.toFixed(2)}): ${drop.id} -> ${keep.id}`);
        }
      }
    }
  }

  return { totalDocs: docs.length, exactDuplicates: exact, nearDuplicates: near, crossSystemLinks: cross, mergedInto };
}

function sameishTitle(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const A = new Set(norm(a).split(" "));
  const B = new Set(norm(b).split(" "));
  return jaccard(A, B) > 0.5;
}

function pickAuthoritative(a: SourceDoc, b: SourceDoc): [SourceDoc, SourceDoc] {
  const rank = (d: SourceDoc) =>
    (d.system === "givingdata" ? 3 : d.system === "airtable" ? 1 : 2) * 100 +
    d.extractionConfidence * 10 +
    (d.date ? Date.parse(d.date) / 1e13 : 0);
  return rank(a) >= rank(b) ? [a, b] : [b, a];
}

// ---------------------------------------------------------------------------

/** Attach canonical entity refs to each doc, and return the entity list. */
function resolveEntities(docs: SourceDoc[], log: (m: string) => void): EntityRef[] {
  const grants = new Map<string, EntityRef>();
  const orgs = new Map<string, EntityRef>();
  const funds = new Map<string, EntityRef>();
  const theses = new Map<string, EntityRef>();

  const normOrg = (s: string) =>
    s.toLowerCase().replace(/\b(inc|foundation|the|alliance|of|for)\b/g, "").replace(/[^a-z0-9]/g, "").trim();

  for (const d of docs) {
    const refs: EntityRef[] = [];
    const gid = (d.meta.grantId as string) || (d.system === "givingdata" ? (d.sourceId.match(/^GD-\d+/)?.[0] ?? null) : null);
    if (gid) {
      const e = grants.get(gid) ?? { kind: "grant" as const, id: gid, label: `Grant ${gid}` };
      grants.set(gid, e);
      refs.push(e);
    }
    const orgName = (d.meta.organization as string) || null;
    if (orgName) {
      const key = normOrg(orgName);
      const e = orgs.get(key) ?? { kind: "organization" as const, id: key, label: orgName };
      // keep the longest label seen (usually the fullest name)
      if (orgName.length > e.label.length) e.label = orgName;
      orgs.set(key, e);
      refs.push(e);
    }
    const fund = d.meta.fund as string | undefined;
    if (fund) {
      const e = funds.get(fund) ?? { kind: "fund" as const, id: sha1(fund).slice(0, 8), label: fund };
      funds.set(fund, e);
      refs.push(e);
    }
    for (const t of (d.meta.thesisTags as string[] | undefined) ?? []) {
      const e = theses.get(t) ?? { kind: "thesis-area" as const, id: sha1(t).slice(0, 8), label: t };
      theses.set(t, e);
      refs.push(e);
    }
    const ta = d.meta.thesisArea as string | undefined;
    if (ta) {
      const e = theses.get(ta) ?? { kind: "thesis-area" as const, id: sha1(ta).slice(0, 8), label: ta };
      theses.set(ta, e);
      refs.push(e);
    }
    d.entities = dedupeRefs(refs);
  }

  // --- graph join: propagate grant <-> org across docs that only carry one side ---
  const grantToOrg = new Map<string, EntityRef>();
  const orgToGrant = new Map<string, EntityRef>();
  for (const d of docs) {
    const g = d.entities.find((e) => e.kind === "grant");
    const o = d.entities.find((e) => e.kind === "organization");
    if (g && o) {
      grantToOrg.set(g.id, o);
      orgToGrant.set(o.id, g);
    }
    // Airtable org profiles carry an explicit GivingData grant id
    const gdId = d.meta.givingDataId as string | undefined;
    if (o && gdId) orgToGrant.set(o.id, grants.get(gdId) ?? { kind: "grant", id: gdId, label: `Grant ${gdId}` });
  }
  let joined = 0;
  for (const d of docs) {
    const g = d.entities.find((e) => e.kind === "grant");
    const o = d.entities.find((e) => e.kind === "organization");
    if (g && !o && grantToOrg.has(g.id)) {
      d.entities.push(grantToOrg.get(g.id)!);
      joined++;
    } else if (o && !g && orgToGrant.has(o.id)) {
      d.entities.push(orgToGrant.get(o.id)!);
      joined++;
    }
    d.entities = dedupeRefs(d.entities);
  }

  const all = [...grants.values(), ...orgs.values(), ...funds.values(), ...theses.values()];
  log(`  resolved ${grants.size} grants, ${orgs.size} organizations, ${funds.size} funds, ${theses.size} thesis areas · joined ${joined} docs across grant<->org`);
  return all;
}

function dedupeRefs(refs: EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const k = `${r.kind}:${r.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------

function chunkDoc(d: SourceDoc): Omit<Chunk, "vector">[] {
  // Split on blank lines, then greedily pack to ~120 tokens keeping paragraph boundaries.
  const paras = d.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  let bufTokens = 0;
  for (const p of paras) {
    const n = tokenize(p).length;
    if (bufTokens + n > 140 && buf) {
      out.push(buf.trim());
      buf = "";
      bufTokens = 0;
    }
    buf += (buf ? "\n\n" : "") + p;
    bufTokens += n;
  }
  if (buf.trim()) out.push(buf.trim());

  return out.map((text, i) => ({
    id: `${d.id}#${i}`,
    docId: d.id,
    system: d.system,
    deepLink: d.deepLink,
    docTitle: d.title,
    text,
    date: d.date,
    tier: d.tier,
    acl: d.acl,
    entities: d.entities,
    tokens: tokenize(`${d.title}\n${text}`),
  }));
}

// ---------------------------------------------------------------------------

/** Assemble the people Compass knows about, from grant / org / interaction records. */
function buildDirectory(docs: SourceDoc[]): IndexPerson[] {
  const byKey = new Map<string, IndexPerson>();
  const internalEmail = (name: string) =>
    name && /^[A-Za-z][\w'’.-]* [A-Za-z]/.test(name)
      ? `${name.toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).join(".")}@foundation.example`
      : null;

  const add = (p: IndexPerson) => {
    const key = `${p.name}|${p.kind}`.toLowerCase();
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, p);
      return;
    }
    cur.grantIds = [...new Set([...cur.grantIds, ...p.grantIds])];
    cur.orgLabels = [...new Set([...cur.orgLabels, ...p.orgLabels])];
    if (!cur.email && p.email) cur.email = p.email;
    if (cur.role === "contact" && p.role !== "contact") cur.role = p.role;
  };

  for (const d of docs) {
    const grantId = (d.meta.grantId as string) || null;
    const org = (d.meta.organization as string) || (d.meta.givingDataId as string) || "";
    const gid = grantId ? [grantId] : [];
    const ol = org ? [org] : [];

    const po = d.meta.programOfficer as string | undefined;
    if (po) add({ name: po, role: "program officer", email: internalEmail(po), kind: "internal", grantIds: gid, orgLabels: ol, source: d.system });

    const ro = d.meta.relationshipOwner as string | undefined;
    if (ro) add({ name: ro, role: "relationship owner", email: internalEmail(ro), kind: "internal", grantIds: gid, orgLabels: ol, source: d.system });

    for (const c of (d.meta.contacts as { title: string; email: string | null }[] | undefined) ?? []) {
      add({ name: c.title, role: "contact", email: c.email && c.email !== "REDACTED" ? c.email : null, kind: "external", grantIds: gid, orgLabels: ol, source: d.system });
    }
    for (const a of (d.meta.attendees as string[] | undefined) ?? []) {
      add({ name: a, role: `attended a ${d.meta.interactionType ?? "meeting"}`, email: internalEmail(a), kind: "internal", grantIds: gid, orgLabels: ol, source: d.system });
    }
    if (d.meta.author && d.system === "drive") {
      const au = d.meta.author as string;
      add({ name: au, role: `wrote "${d.title}"`, email: internalEmail(au), kind: "internal", grantIds: gid, orgLabels: ol, source: d.system });
    }
  }
  return [...byKey.values()];
}

function gapReport(docs: SourceDoc[]): GapReport {
  const missingByGrant: Record<string, string[]> = {};
  const grantsWithNoProposal: string[] = [];
  const untaggedGrants: string[] = [];
  const grantsWithNoOrgRecord: string[] = [];

  const factSheets = docs.filter((d) => d.meta.recordType === "grant-fact-sheet");
  const orgProfiles = new Set(docs.filter((d) => d.meta.recordType === "org-profile").map((d) => d.meta.givingDataId));

  for (const fs of factSheets) {
    const gid = fs.meta.grantId as string;
    const reqs = (fs.meta.requirements as any[]) ?? [];
    const missing: string[] = [];
    for (const r of reqs) {
      if (r.type === "Proposal" && r.status !== "Received") grantsWithNoProposal.push(gid);
      if (!r.submittedDocId && (r.status === "Overdue" || r.status === "Received")) missing.push(`${r.type} (status: ${r.status})`);
      if (r.status === "Overdue") missing.push(`${r.type} — OVERDUE, due ${r.dueDate}`);
    }
    if (missing.length) missingByGrant[gid] = [...new Set(missing)];
    if (!fs.meta.thesisArea) untaggedGrants.push(gid);
    if (!orgProfiles.has(gid)) grantsWithNoOrgRecord.push(gid);
  }

  return { missingByGrant, grantsWithNoOrgRecord, grantsWithNoProposal: [...new Set(grantsWithNoProposal)], untaggedGrants };
}
