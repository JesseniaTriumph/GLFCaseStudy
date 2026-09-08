import { test } from "node:test";
import assert from "node:assert/strict";
import { AuditLog, type AuditRecord } from "../src/security/audit.js";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = () => join(mkdtempSync(join(tmpdir(), "compass-audit-")), "log.jsonl");

test("append + verify: an intact chain verifies", () => {
  const p = tmp();
  const log = new AuditLog(p);
  log.append({ type: "auth", user: "u", result: "ok" });
  log.append({ type: "query", user: "u", question: "q", citedRefs: [], citedTiers: [], withheld: 0, withheldTiers: [], confidence: "high", mode: "extractive" });
  assert.equal(log.verify().ok, true);
  assert.equal(log.length, 2);
  rmSync(p, { force: true });
});

test("head is GENESIS on an empty log, the last hash otherwise", () => {
  const p = tmp();
  const log = new AuditLog(p);
  assert.match(log.head, /^0{64}$/);
  const rec = log.append({ type: "admin", user: "u", action: "x" });
  assert.equal(log.head, rec.hash);
  rmSync(p, { force: true });
});

test("editing a past entry on disk is detected", () => {
  const p = tmp();
  const log = new AuditLog(p);
  log.append({ type: "auth", user: "u", result: "ok" });
  log.append({ type: "auth", user: "u", result: "ok", reason: "second" });
  const rows = readFileSync(p, "utf8").split("\n").filter(Boolean);
  const rec = JSON.parse(rows[0]!) as AuditRecord;
  (rec.event as { reason?: string }).reason = "rewritten";
  rows[0] = JSON.stringify(rec);
  writeFileSync(p, rows.join("\n") + "\n");
  const reloaded = new AuditLog(p);
  const v = reloaded.verify();
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.brokenAt, 0);
  rmSync(p, { force: true });
});

test("deleting an entry breaks the chain", () => {
  const p = tmp();
  const log = new AuditLog(p);
  log.append({ type: "auth", user: "u", result: "ok" });
  log.append({ type: "auth", user: "u", result: "denied" });
  log.append({ type: "auth", user: "u", result: "ok" });
  const rows = readFileSync(p, "utf8").split("\n").filter(Boolean);
  writeFileSync(p, [rows[0], rows[2]].join("\n") + "\n");
  assert.equal(new AuditLog(p).verify().ok, false);
  rmSync(p, { force: true });
});

test("the off-host sink receives every appended record", () => {
  const p = tmp();
  const seen: AuditRecord[] = [];
  const log = new AuditLog(p, (r) => seen.push(r));
  log.append({ type: "auth", user: "u", result: "ok" });
  log.append({ type: "admin", user: "u", action: "killswitch", detail: "engaged" });
  assert.equal(seen.length, 2);
  assert.equal(seen[1]!.event.type, "admin");
  rmSync(p, { force: true });
});
