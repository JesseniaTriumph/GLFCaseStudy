import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSourcePreview } from "../src/server/source-preview.js";
import type { CorpusIndex } from "../src/core/types.js";

const chunk = (over: Record<string, unknown>) =>
  ({
    id: "drive:doc#0",
    docId: "drive:doc",
    system: "drive",
    deepLink: "https://drive.google.com/file/d/EXAMPLE-doc/view",
    docTitle: "Riverbend check-in",
    text: "Placement pace is behind plan. Wage outcomes are ahead of plan.",
    tier: "team",
    acl: ["*"],
    entities: [],
    ...over,
  }) as never;

const idx = (chunks: unknown[]): CorpusIndex => ({ chunks } as never);
const yes = () => true;
const no = () => false;

test("renders a permitted document: 200, source-system chrome, highlighted passage, real link shown", () => {
  const { status, html } = renderSourcePreview({
    index: idx([chunk({})]),
    docId: "drive:doc",
    highlight: "Wage outcomes are ahead of plan.",
    canRead: yes,
  });
  assert.equal(status, 200);
  assert.match(html, /Demo preview/);
  assert.match(html, /Google Drive/);
  assert.match(html, /Riverbend check-in/);
  assert.match(html, /<mark id="hl">Wage outcomes are ahead of plan\.<\/mark>/);
  assert.match(html, /EXAMPLE-doc/, "the real deep link is shown for the production rewire");
});

test("reassembles a multi-chunk doc in #N order", () => {
  const { html } = renderSourcePreview({
    index: idx([
      chunk({ id: "drive:doc#1", text: "SECOND part." }),
      chunk({ id: "drive:doc#0", text: "FIRST part." }),
    ]),
    docId: "drive:doc",
    highlight: "",
    canRead: yes,
  });
  assert.ok(html.indexOf("FIRST part.") < html.indexOf("SECOND part."));
});

test("restricted / not-permitted → 403 with the same wording a query refusal uses, no content", () => {
  const secret = chunk({ tier: "restricted", text: "PRIVILEGED counsel advice about indemnification." });
  const { status, html } = renderSourcePreview({ index: idx([secret]), docId: "drive:doc", highlight: "", canRead: no });
  assert.equal(status, 403);
  assert.match(html, /outside your approved access/i);
  assert.doesNotMatch(html, /PRIVILEGED counsel advice/, "restricted content never rendered");
});

test("a restricted stub → 403, never 404 (the topic is known, the content is not)", () => {
  const stub = chunk({ restrictedStub: true, text: "" });
  const { status } = renderSourcePreview({ index: idx([stub]), docId: "drive:doc", highlight: "", canRead: no });
  assert.equal(status, 403);
});

test("unknown document id → 404", () => {
  const { status, html } = renderSourcePreview({ index: idx([chunk({})]), docId: "drive:missing", highlight: "", canRead: yes });
  assert.equal(status, 404);
  assert.match(html, /No such source|doesn't match anything/i);
});

test("a machine-translated doc is labelled in the banner", () => {
  const { html } = renderSourcePreview({
    index: idx([chunk({ translated: true, sourceLang: "es" })]),
    docId: "drive:doc",
    highlight: "",
    canRead: yes,
  });
  assert.match(html, /machine-translated from es/i);
});

test("HTML in the document text is escaped, not rendered", () => {
  const { html } = renderSourcePreview({
    index: idx([chunk({ text: "<script>alert(1)</script> and <b>bold</b>" })]),
    docId: "drive:doc",
    highlight: "",
    canRead: yes,
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("a highlight that isn't found verbatim still renders the doc (falls through to plain paragraphs)", () => {
  const { status, html } = renderSourcePreview({
    index: idx([chunk({})]),
    docId: "drive:doc",
    highlight: "a phrase that does not occur anywhere in the text at all",
    canRead: yes,
  });
  assert.equal(status, 200);
  assert.match(html, /Placement pace is behind plan/);
});

test("an unknown source system still renders with a generic label", () => {
  const { status, html } = renderSourcePreview({
    index: idx([chunk({ system: "sharepoint", docId: "sharepoint:x", id: "sharepoint:x#0" })]),
    docId: "sharepoint:x",
    highlight: "",
    canRead: yes,
  });
  assert.equal(status, 200);
  assert.match(html, /sharepoint/i);
});
