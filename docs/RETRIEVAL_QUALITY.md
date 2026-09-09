# Retrieval quality measurements

`scripts/retrieval-metrics.ts` is a measurement tool, not a release gate. It always
exits 0, including when a measurement fails. `npm run eval` remains the release
gate for expected retrieval, refusals, and leakage; these ranking metrics do not
replace those checks.

## Run

From the repository root, with dependencies installed:

```sh
npx tsx scripts/retrieval-metrics.ts
COMPASS_CORPUS=full npx tsx scripts/retrieval-metrics.ts
```

Both commands run A/B automatically. Baseline explicitly unsets `COMPASS_RERANK`;
reranked sets it to `1`. Each arm runs in a fresh process, so the flag takes effect
even if the reranker reads it during module initialization. An inherited rerank
flag cannot accidentally enable the baseline. Other environment settings are
preserved. On a revision with no reranker wired, the two columns come out
identical.

The default run reads `eval/gold.json`; full mode instead reads
`eval/gold-full.json`. Neither file is changed. Each arm builds an in-memory index
with the same `runPipeline`, `ADAPTERS`, `CORPUS` options, and `resolveTranslator`
setup as `scripts/eval.ts`. It uses the gold case's `PRINCIPALS[c.persona]` and
calls `answerQuestion` with `k: 10` and follow-up generation disabled.

Stdout contains Markdown suitable for pasting into a review. Failed arms show
`N/A` with an explanation on stderr; this is unavailable data, not a zero score.
An empty eligible set shows `N/A` for averages and zero counts. The non-gating
exit behavior applies once the script starts; a missing Node/tsx installation or
an external process termination can still prevent execution.

## What is measured

Only cases without `expectRefusal: true` and with a nonempty `expectSources`
array are included. Each case has equal weight, regardless of how many expected
sources it lists. An expected id is matched against the answer's citation `ref`
values using the **same rule `scripts/eval.ts` scores retrieval with** — exact id,
the expected id is a suffix of the ref, or the ref ends with the expected id's
body (the part after the `system:` prefix). A source therefore counts as
retrieved here iff the release gate would also count it. On the current gold
sets every match is exact; the looser cases only matter if a future gold id and
its citation ref diverge in form.

Ranks are one-based positions in the first ten returned answer citations. They
are not ranks of distinct documents: two passages from a document can occupy two
positions. Each expected ID earns credit only at its first occurrence; repeated
expected IDs are also counted once. Unexpected refusals yield no citations and
score zero. Computed schedule answers, if present in a future gold set, are scored
in their returned citation order too; this measures the answer citation path,
not exclusively the raw search ranker.

| Metric | Meaning here |
| --- | --- |
| recall@1/3/5/10 | For each case, the fraction of its distinct expected sources present within the first k citations; then averaged over cases. This is source recall, not the fraction of cases with any hit. |
| MRR | Mean reciprocal rank of the first expected source: rank 1 earns 1, rank 2 earns 0.5, and no expected source in the returned top 10 earns 0. This is truncated to the ten-citation retrieval window. |
| nDCG@10 | Binary relevance with logarithmic rank discount. A distinct expected source first appearing at rank r earns `1 / log2(r + 1)`. Divide each case's sum by the ideal sum for its expected sources at ranks 1 through `min(10, expected count)`, then average. Unlisted sources and repeated citations earn no credit. |
| No expected source retrieved | Number of eligible cases with none of their expected IDs anywhere in the returned top 10 citations. Lower is better. |
| Eligible cases | Number of non-refusal cases with at least one expected source; the denominator of the averages. |

All averages range from 0 to 1; higher is better. Delta is reranked minus
baseline in raw score units, not percent change. Positive deltas are improvements
for recall, MRR, and nDCG; a negative delta is an improvement for complete misses.
Values are rounded to four decimals only for display.

## What good looks like

For these small, curated fixtures, a useful target is complete source recall by
rank 10 and zero complete misses, with the expected evidence moving toward the
first few citations. Both sets already reach recall@10 of 1.0 with no misses; the
reranker's job is to pull the expected evidence forward — which it does (see the
snapshot: recall@1, MRR, and nDCG all rise sharply, most of all on the noisier
5-year corpus, while recall@10 and misses are unchanged). These are comparison
targets, not enforced thresholds. With multiple expected sources, recall@1 cannot
reach 1 for every case, even with ideal ordering.

The current sets contain 28 and 10 eligible cases. A single question can
move the averages substantially, and unlisted sources may still be useful.
Scores describe agreement with the annotated expected IDs, not exhaustive
relevance, answer correctness, or permission safety. Review changes alongside
the gold questions and the release eval. Re-run after gold-set changes and
compare A/B on the same revision, corpus, and translation/embedding settings.

## Snapshot

Measured on 2026-09-09 on integrated `main` (goldset + metrics + rerank merged),
with default translation/embedding settings. Reranked = `COMPASS_RERANK=1`
(`bge-reranker-base`, q8). Both commands completed with exit 0. Full mode selects
the glossary translator by default.

Default corpus (`eval/gold.json`, 28 eligible cases):

| Metric | Baseline | Reranked | Delta |
| --- | ---: | ---: | ---: |
| recall@1 | 0.5000 | 0.6964 | +0.1964 |
| recall@3 | 0.9107 | 0.9286 | +0.0179 |
| recall@5 | 0.9821 | 0.9821 | 0.0000 |
| recall@10 | 1.0000 | 1.0000 | 0.0000 |
| MRR | 0.7470 | 0.8780 | +0.1310 |
| nDCG@10 | 0.8041 | 0.9025 | +0.0985 |
| No expected source retrieved | 0 | 0 | 0 |

Full corpus (`eval/gold-full.json`, 10 eligible cases — the noisier 5-year corpus,
where first-pass ranking has ~59 grants competing):

| Metric | Baseline | Reranked | Delta |
| --- | ---: | ---: | ---: |
| recall@1 | 0.1000 | 0.7000 | +0.6000 |
| recall@3 | 0.7000 | 0.9500 | +0.2500 |
| recall@5 | 0.9500 | 1.0000 | +0.0500 |
| recall@10 | 1.0000 | 1.0000 | 0.0000 |
| MRR | 0.4200 | 0.9000 | +0.4800 |
| nDCG@10 | 0.5755 | 0.9032 | +0.3277 |
| No expected source retrieved | 0 | 0 | 0 |

The reranker moves the right evidence to rank 1 far more often (recall@1 +0.20
default, +0.60 full) and lifts MRR / nDCG correspondingly, while never dropping a
source that first-pass retrieval already surfaced (recall@10 and misses flat).
