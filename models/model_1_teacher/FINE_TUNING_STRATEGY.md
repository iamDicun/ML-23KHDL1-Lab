# Fine-Tuning Strategy (Model 1 -> Model 2)

## Goal

Use Model 1 as a teacher to generate high-confidence pseudo labels, then train Model 2 as the final deployable student model.

## Phase A - Train Teacher (Model 1)

1. Train on trusted labeled data (VLSP train/dev).
2. Select checkpoint by best dev `mean_macro_f1`.
3. Keep per-aspect metrics for failure analysis.

Exit criteria:

- Mean macro-F1 is stable and acceptable.
- No aspect with severe collapse (for example, macro-F1 < 0.60).

## Phase B - Pseudo Labeling

1. Run inference on crawled unlabeled reviews.
2. For each aspect, compute softmax confidence.
3. Keep only high-confidence samples:
   - Strict rule: keep sample only if all 6 aspect confidences >= 0.80
   - Relaxed rule: keep per-aspect labels where confidence >= 0.90
4. Store confidence scores with labels for future weighting.

Recommended output columns:

- `Review`
- 6 pseudo label columns
- 6 confidence columns
- `source` (real or pseudo)

## Phase C - Human Correction

1. Sample uncertain or high-impact pseudo labels.
2. Prioritize samples with:
   - Aspect confidence near threshold
   - Class imbalance classes
   - Semantically noisy text
3. Correct labels manually and mark rows as `pseudo_fixed`.

## Phase D - Train Student (Model 2)

Train from base pretrained checkpoint (not from Model 1 weights) to avoid teacher bias lock-in.

### Data mix

- Real labeled data (highest priority)
- Pseudo fixed data (second)
- High-confidence pseudo data (third)

### Loss weighting

Use weighted multi-source loss:

- `loss_total = loss_real + lambda_fixed * loss_pseudo_fixed + lambda_pseudo * loss_pseudo`
- Suggested start: `lambda_fixed = 0.7`, `lambda_pseudo = 0.3`

### Curriculum

1. Warm-up on real data only (1 epoch).
2. Add pseudo fixed data (1-2 epochs).
3. Add high-confidence pseudo data (remaining epochs).

## Phase E - Validation and Selection

1. Validate only on trusted dev/test labels.
2. Compare Model 1 vs Model 2:
   - Mean macro-F1
   - Aspect-level macro-F1
   - Confusion patterns for minority classes
3. Keep Model 2 only if it improves trusted-set metrics.

## Practical Tips

- Preserve class distribution with weighted sampling.
- Use early stopping on trusted validation set.
- Save confidence histograms per aspect to tune threshold.
- Track experiment metadata (thresholds, lambdas, split, random seed).

## Suggested Experiments

1. Threshold sweep: 0.75 / 0.80 / 0.85 / 0.90.
2. Loss weight sweep for pseudo branch.
3. Compare hard labels vs confidence-weighted pseudo labels.
4. Compare shared-head vs deeper per-aspect head.
