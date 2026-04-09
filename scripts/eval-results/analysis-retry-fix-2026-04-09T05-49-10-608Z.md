# Retry Fix Verification — 2026-04-09

Run file: `scripts/eval-results/run-2026-04-09T05-49-10-608Z.json`

## Comparison vs regression baseline

| Metric | Regression (Apr 9) | This run | Delta |
|---|---:|---:|---:|
| Overall pass rate | 68.0% | 88.0% | +20.0 pts |
| Avg word count | 703 | 718.2 | +15.2 |
| Retry success rate | 62.5% | 84.2% | +21.7 pts |

## Verdict

Retry fix confirmed.

The strengthened retry expansion materially improved recovery rate. The pass rate moved well above the 74% confirmation threshold, average passing draft length increased, and retry success rose sharply from 62.5% to 84.2%.

## Failure review

Only 3 runs failed out of 25:

1. Coast guard signals story run 3
   - Failure: `OpenAI response titles must be complete and publication-ready.`
   - Word count: 847
2. Guardianship legal tragedy run 4
   - Failure: `Retry draft is still too short for target runtime.`
   - Word count: 628
3. Corporate whistleblower run 5
   - Failure: `Retry draft is still too short for target runtime.`
   - Word count: 636

The dominant short-retry failure mode did not disappear entirely, but it dropped to 2 failures instead of dominating the batch.

## Takeaway

The retry prompt change did what it needed to do: it improved both overall pass rate and retry recovery without needing broader prompt or validator changes in this pass.
