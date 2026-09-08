import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubPii, looksLikeParticipantData } from "../src/pipeline/pii.js";

test("scrubPii: redacts a personal email, keeps a role address", () => {
  const r = scrubPii("Reach Jane at jane.doe@example.org or grants@foundation.org");
  assert.match(r.text, /\[email@example\.org\]/);
  assert.match(r.text, /grants@foundation\.org/); // role address kept
});

test("scrubPii: SSN, phone", () => {
  const r = scrubPii("SSN 123-45-6789, call 415-555-0132");
  assert.match(r.text, /\[SSN\]/);
  assert.match(r.text, /\[phone\]/);
  assert.ok(r.score >= 1);
});

test("scrubPii: a Luhn-valid card is masked, an invalid one is left alone", () => {
  const valid = scrubPii("card 4242 4242 4242 4242");
  assert.match(valid.text, /\[card \.\.4242\]/);
  const invalid = scrubPii("code 1234 1234 1234 1234");
  assert.match(invalid.text, /1234 1234 1234 1234/);
});

test("scrubPii: bank/routing keyword + number", () => {
  const r = scrubPii("routing number: 123456789");
  assert.match(r.text, /\.\.6789/);
});

test("scrubPii: DOB and passport", () => {
  const r = scrubPii("DOB: 01/02/1990 passport number A1234567");
  assert.match(r.text, /\[date\]/);
  assert.match(r.text, /\[id\]/);
});

test("scrubPii: clean text scores 0 and is unchanged", () => {
  const r = scrubPii("The grantee placed 2,610 caregivers in Year 1.");
  assert.equal(r.score, 0);
  assert.equal(r.findings.length, 0);
});

test("looksLikeParticipantData: participant language + a name pattern", () => {
  assert.equal(
    looksLikeParticipantData("Participant Maria Gomez completed the program and was placed in March."),
    true
  );
});

test("looksLikeParticipantData: aggregate reporting is not flagged", () => {
  assert.equal(
    looksLikeParticipantData("The program enrolled 40 participants, mostly heads of household."),
    false
  );
});
