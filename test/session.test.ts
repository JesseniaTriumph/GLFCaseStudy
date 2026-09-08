import { test } from "node:test";
import assert from "node:assert/strict";
import {
  issueSession,
  verifySession,
  revokeUser,
  revokeAll,
  _clearRevocations,
  cookieHeader,
  clearCookieHeader,
  readCookie,
} from "../src/server/session.js";

const base = { sub: "u1", email: "u1@example.org", name: "U One", groups: ["programs"], groupsResolved: true };

test("issue → verify round-trips the claims", () => {
  _clearRevocations();
  const c = verifySession(issueSession(base));
  assert.equal(c?.email, "u1@example.org");
  assert.deepEqual(c?.groups, ["programs"]);
});

test("a tampered payload fails verification", () => {
  const tok = issueSession(base);
  const [payload, sig] = tok.split(".");
  const forged = JSON.parse(Buffer.from(payload!, "base64url").toString());
  forged.groups = ["ceo", "leadership"];
  const bad = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;
  assert.equal(verifySession(bad), null);
});

test("garbage / empty tokens → null", () => {
  assert.equal(verifySession(undefined), null);
  assert.equal(verifySession(""), null);
  assert.equal(verifySession("only-one-part"), null);
});

test("revokeUser invalidates that user's existing sessions", () => {
  _clearRevocations();
  const tok = issueSession(base);
  assert.ok(verifySession(tok));
  revokeUser("u1");
  assert.equal(verifySession(tok), null);
});

test("revokeUser does not affect a different user", () => {
  _clearRevocations();
  const other = issueSession({ ...base, sub: "u2", email: "u2@example.org" });
  revokeUser("u1");
  assert.ok(verifySession(other));
});

test("revokeAll invalidates everything issued before the call", () => {
  _clearRevocations();
  const tok = issueSession(base);
  revokeAll();
  assert.equal(verifySession(tok), null);
  _clearRevocations();
});

test("cookieHeader: HttpOnly + SameSite=Strict always; Secure only when asked", () => {
  assert.match(cookieHeader("t", true), /HttpOnly/);
  assert.match(cookieHeader("t", true), /SameSite=Strict/);
  assert.match(cookieHeader("t", true), /Secure/);
  assert.ok(!/Secure/.test(cookieHeader("t", false)));
});

test("clearCookieHeader: Max-Age=0", () => {
  assert.match(clearCookieHeader(false), /Max-Age=0/);
});

test("readCookie: parses the compass_session value out of a Cookie header", () => {
  assert.equal(readCookie({ headers: { cookie: "a=1; compass_session=abc.def; b=2" } }), "abc.def");
  assert.equal(readCookie({ headers: {} }), undefined);
});
