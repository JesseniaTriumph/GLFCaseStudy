/**
 * The source-agnostic pipeline: clean -> dedupe -> resolve entities -> chunk -> index.
 * Everything here operates on SourceDoc / Chunk and never looks at which adapter produced a doc.
 */
import type { SourceAdapter } from "../adapters/types.js";
import type { SourceDoc, Chunk, CorpusIndex, EntityRef, DedupeReport, GapReport, Tier, IndexPerson } from "../core/types.js";
import { tokenize, jaccard, tfidfVector, detectLanguage, bilingualBridge } from "../util/text.js";
import { sha1 } from "../util/hash.js";
import { scrubPii, looksLikeParticipantData } from "./pii.js";
import { RawStore } from "./rawstore.js";

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
  /** if set, every ingested document's original bytes are written to this immutable raw store */
  rawDir?: string;
  /** optional NER redactor (transformers.js) for free-text person names — opt-in */
  nerRedactor?: import("./ner.js").NerRedactor;
  /** optional translator — non-English docs get an English rendering for retrieval + the brief */
  translator?: import("./translate.js").Translator | null;
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

  // ---------- 1b. PRESERVE — immutable content-addressed raw store ----------
  if (opts.rawDir) {
    const raw = new RawStore(opts.rawDir);
    for (const d of docs) raw.put(d);
    const mf = raw.manifest();
    log(`  preserved ${mf.count} raw object(s), ${(mf.totalBytes / 1024).toFixed(1)} KB → ${opts.rawDir}`);
  }

  // ---------- 1c. NER NAME REDACTION (opt-in) ----------
  if (opts.nerRedactor) {
    log(`  NER name redaction with ${opts.nerRedactor.id}…`);
    let nerNames = 0;
    docs = await Promise.all(
      docs.map(async (d) => {
        const r = await opts.nerRedactor!.redact(d.text);
        nerNames += r.findings.reduce((s, f) => s + f.count, 0);
        return { ...d, text: r.text };
      })
    );
    log(`  NER redacted ${nerNames} name span(s)`);
  }

  // ---------- 2. CLEAN + PII PASS ----------
  let quarantined = 0;
  const quarantinedIds: string[] = [];
  let injectionQuarantined = 0;
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
      let piiRaised = false;
      if ((pii.score >= 1.5 || looksLikeParticipantData(pii.text)) && tier !== "restricted" && tier !== "never-ingest") {
        tier = "restricted";
        piiRaised = true;
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
        meta: { ...d.meta, piiFindings: pii.findings, piiRaised },
      };
    })
    .filter((d) => {
      if (d.extractionConfidence < QUARANTINE_BELOW) {
        quarantined++;
        quarantinedIds.push(d.id);
        log(`  quarantined (low extraction confidence ${d.extractionConfidence}): ${d.id}`);
        return false;
      }
      const injScore = injectionScore(d.text);
      if (injScore >= INJECTION_QUARANTINE_AT) {
        injectionQuarantined++;
        quarantinedIds.push(d.id);
        log(`  quarantined (prompt-injection signals: ${injScore}): ${d.id}`);
        return false;
      }
      return true;
    });

  // ---------- 2b. TRANSLATE non-English docs to English for retrieval + the brief ----------
  // The citation still deep-links to the original; the chunk carries `translated: true`.
  if (opts.translator) {
    let translatedCount = 0;
    docs = await Promise.all(
      docs.map(async (d) => {
        if (d.language !== "es") return d;
        const en = await opts.translator!.toEnglish(d.text, d.language);
        if (en && en !== d.text) {
          translatedCount++;
          return { ...d, meta: { ...d.meta, englishText: en, translated: true, sourceLang: d.language, translator: opts.translator!.id } };
        }
        return d;
      })
    );
    if (translatedCount) log(`  translated ${translatedCount} non-English document(s) to English (${opts.translator.id})`);
  }

  // ---------- 3. TIER EXCLUSION (defence in depth) ----------
  // Excluded docs are dropped from the index. For docs that are Restricted BY POLICY
  // (board / compensation / legal / declined-applicant) we keep a metadata-only stub so
  // retrieval can honestly say "this resolves to Restricted material". For docs raised to
  // Restricted only because they carry participant PII, we keep NO stub — they vanish
  // entirely, and the coverage line's participant-data note is the only trace. A stub
  // there would wrongly steer a legitimate question about the grant into a refusal.
  const beforeTier = docs.length;
  const restrictedStubDocs = docs.filter((d) => d.tier === "restricted" && !d.meta.piiRaised);
  docs = docs.filter((d) => !exclude.has(d.tier));
  const tierExcluded = beforeTier - docs.length;

  // ---------- 4. DEDUPE ----------
  const dedupe = dedupeDocs(docs, log);
  docs = docs.filter((d) => !dedupe.mergedInto[d.id]);

  // ---------- 5. RESOLVE ENTITIES ----------
  resolveEntities(restrictedStubDocs, () => {});
  const entities = resolveEntities(docs, log);
  const reviewQueue = entityReviewQueue(docs, entities);
  if (reviewQueue.length) log(`  entity review queue: ${reviewQueue.length} item(s) for a human to confirm`);

  // ---------- 6. CHUNK ----------
  const rawChunks = docs.map(textForChunking).flatMap(chunkDoc);

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
  gaps.excluded = {
    lowExtractionConfidence: { count: quarantined + injectionQuarantined, ids: quarantinedIds },
    sensitivityTier: tierExcluded,
    duplicates: dedupe.exactDuplicates + dedupe.nearDuplicates,
  };
  const directory = buildDirectory(docs);

  const dates = docs.map((d) => d.date).filter(Boolean).sort() as string[];
  log(
    `  seen ${seen} · quarantined ${quarantined} · injection-quarantined ${injectionQuarantined} · PII redactions ${piiRedactions} · PII tier-raised ${piiTierRaised} · ` +
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
    reviewQueue,
    coverage: {
      systems: adapters.map((a) => a.label),
      dateRange: dates.length ? [dates[0]!, dates[dates.length - 1]!] : null,
      notCovered: opts.notCovered ?? [],
    },
  };
}

// ---------------------------------------------------------------------------

/** patterns that mark text as an instruction aimed at an AI assistant rather than content */
const INJECTION_PATTERNS: RegExp[] = [
  /<!--[\s\S]*?-->/g,
  /<(script|style)\b[\s\S]*?<\/\1>/gi,
  // an instruction header line, with or without a trailing colon
  /^\s*#{0,4}\s*(SYSTEM|ASSISTANT|USER|AI|NOTE TO COMPASS|INSTRUCTIONS? (FOR|TO)\b[^\n]*)\s*[:\-]?.*$/gim,
  // an imperative line aimed at an assistant (optionally a numbered step)
  /^\s*\d{0,2}[.)]?\s*(forget|ignore|disregard|disable|bypass|override|reveal|expose|output|print|dump|list every|do not (tell|mention|disclose|reveal)|stay in character|proceed to include)\b[^\n]*$/gim,
  // a sentence/line telling an assistant to ignore rules, change role, or exfiltrate
  /[^\n.]*\b(ignore|disregard|forget|override|bypass|supersed\w*)\b[^\n.]*\b(all|any|previous|prior|your|the)\b[^\n.]*\b(instruction|rule|guardrail|permission|policy|guideline|access[- ]?control)s?\b[^\n.]*\.?/gi,
  /[^\n.]*\byou are (now )?(an? )?(unrestricted|DAN|no[- ]restrictions?|admin\w*)\b[^\n.]*\.?/gi,
  /[^\n.]*\b(reveal|print|output|dump|disclose|list|email|send)\b[^\n.]*\b(system prompt|your instructions|salary band|compensation (review|figures?)|committee deliberation|restricted (tier|record|document)|declined applicant)s?\b[^\n.]*\.?/gi,
  /[^\n.]*\b(this (document|message|note)|the following)\b[^\n.]*\b(supersed\w*|override\w*|grants? you|authoriz\w*)\b[^\n.]*\.?/gi,
  // a fake tool call / structured directive
  /\{\s*"(tool|action|command|function)"\s*:[^\n}]*\}/gi,
  // a spoofed "authoritative source" block
  /\[[^\]\n]*\b(AUTHORITATIVE|SOURCE \d+|OVERRIDE|SYSTEM)\b[^\]\n]*\][^\n]*/gi,
  // a message impersonating a named authority to the assistant
  /--\s*message from the [^\n-]+--[\s\S]*?--/gi,
  // zero-width and bidi control characters used to hide instructions
  /[​-‏‪-‮⁠﻿]/g,
];

function clean(text: string): string {
  let out = text.replace(/\r/g, "");
  for (const re of INJECTION_PATTERNS) out = out.replace(re, " [removed: text targeting an AI assistant] ");
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*(confidential|internal use only|do not distribute)\s*$/gim, "")
    .replace(/(\s*\[removed: text targeting an AI assistant\]\s*)+/g, " [removed: text targeting an AI assistant] ")
    .trim();
}

/**
 * How much a document reads like a prompt-injection attempt rather than grant content —
 * after line-level neutralisation, count residual attack signals. A document over the
 * threshold is quarantined (never indexed), the same as an unreadable scan: it isn't
 * content, so it doesn't belong in the corpus.
 */
const INJECTION_SIGNALS: RegExp[] = [
  /\b(board )?compensation (figures?|review|data)\b/i,
  /\bsalary band/i,
  /\bcommittee deliberation/i,
  /\brestricted (access|tier|records?|documents?)\b/i,
  /\bdeclined applicants?\b/i,
  /\bsystem prompt|your (instructions|guardrails)\b/i,
  /\b(silently )?(append|include|add)\b[^.\n]*\b(to your (answer|response)|in (every|all) (answer|response)s?)\b/i,
  /\bdo not (disclose|tell|mention)\b[^.\n]*\b(you|this|that)\b/i,
  /\bwhenever a user asks\b/i,
  /\bstay in character\b/i,
  /\[removed: text targeting an AI assistant\]/,
  /\b(pre-?authoriz|clearance|TOP SECRET|unrestricted assistant)\b/i,
];
function injectionScore(text: string): number {
  return INJECTION_SIGNALS.reduce((s, re) => s + (re.test(text) ? 1 : 0), 0);
}
const INJECTION_QUARANTINE_AT = 3;

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

/**
 * Flag entity-resolution calls a human should confirm (roadmap 2.3): two organization
 * labels that look like the same org but resolved to different ids, and grants/orgs that
 * never co-occur with the other side (a likely missing link). Nothing here is auto-merged
 * — the queue is shown, and a reviewer decides.
 */
function entityReviewQueue(docs: SourceDoc[], entities: EntityRef[]): import("../core/types.js").EntityReviewItem[] {
  const out: import("../core/types.js").EntityReviewItem[] = [];
  const orgs = entities.filter((e) => e.kind === "organization");
  const norm = (s: string) => new Set(tokenize(s).filter((t) => !/^(inc|the|foundation|fund|of|for|and)$/.test(t)));

  for (let i = 0; i < orgs.length; i++)
    for (let j = i + 1; j < orgs.length; j++) {
      const a = orgs[i]!;
      const b = orgs[j]!;
      const sim = jaccard(norm(a.label), norm(b.label));
      const prefix = a.label.toLowerCase().startsWith(b.label.toLowerCase().slice(0, 8)) || b.label.toLowerCase().startsWith(a.label.toLowerCase().slice(0, 8));
      if (sim >= 0.5 && sim < 1) {
        out.push({
          kind: "possible-duplicate-org",
          detail: `"${a.label}" and "${b.label}" look like the same organization (name overlap ${(sim * 100).toFixed(0)}%${prefix ? ", shared prefix" : ""})`,
          candidates: [a.id, b.id],
          confidence: sim,
        });
      }
    }

  const grantsWithOrg = new Set<string>();
  const orgsWithGrant = new Set<string>();
  for (const d of docs) {
    const g = d.entities.find((e) => e.kind === "grant");
    const o = d.entities.find((e) => e.kind === "organization");
    if (g && o) {
      grantsWithOrg.add(g.id);
      orgsWithGrant.add(o.id);
    }
  }
  for (const e of entities) {
    if (e.kind === "grant" && !grantsWithOrg.has(e.id))
      out.push({ kind: "grant-without-org", detail: `Grant ${e.id} is never linked to an organization`, candidates: [e.id], confidence: 0.4 });
    if (e.kind === "organization" && !orgsWithGrant.has(e.id))
      out.push({ kind: "org-without-grant", detail: `"${e.label}" is never linked to a grant`, candidates: [e.id], confidence: 0.5 });
  }
  return out.sort((a, b) => a.confidence - b.confidence);
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

  // for a Spanish document, index the English equivalents of key terms too, so an English
  // query still retrieves it (roadmap 3.4). The displayed text is unchanged.
  const bridge = d.language === "es" ? bilingualBridge(d.text) : "";

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
    tokens: tokenize(`${d.title}\n${text}${bridge}`),
    ...(d.meta.translated ? { translated: true, sourceLang: d.meta.sourceLang as string } : {}),
  }));
}

/**
 * When a document was translated (meta.englishText set), we chunk the English so the brief
 * is readable and English queries retrieve it well; the original stays in the raw store and
 * the citation deep-links to it. This runs just before chunking.
 */
function textForChunking(d: SourceDoc): SourceDoc {
  return d.meta.englishText ? { ...d, text: d.meta.englishText as string } : d;
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

  return {
    missingByGrant,
    grantsWithNoOrgRecord,
    grantsWithNoProposal: [...new Set(grantsWithNoProposal)],
    untaggedGrants,
    // filled in by the caller with the real pipeline counts
    excluded: { lowExtractionConfidence: { count: 0, ids: [] }, sensitivityTier: 0, duplicates: 0 },
  };
}
