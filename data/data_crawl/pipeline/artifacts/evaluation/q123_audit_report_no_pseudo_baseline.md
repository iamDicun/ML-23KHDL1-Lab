# Q1 Q2 Q3 Audit Report (No Original Pseudo Baseline)

Date: 2026-03-25

## Scope
- Data context: crawled reviews do not have an original pseudo-label snapshot for before/after comparison.
- Evaluation mode:
  - Q1: sample-selection quality audit (group difficulty check)
  - Q2: single-system absolute quality audit against human labels
  - Q3: single-system none-bias audit against human labels

## Inputs and outputs
- Q1 script: data/data_crawl/pipeline/scripts/evaluate_q1_sample_selection.py
- Q2/Q3 script (rewritten): data/data_crawl/pipeline/scripts/evaluate_q2_q3_model_impact.py
- Q2/Q3 input used: data/data_crawl/pipeline/artifacts/evaluation/q2q3_enhanced_from_output_results_no_v2.csv

Generated files:
- data/data_crawl/pipeline/artifacts/evaluation/q1_group_error_summary.csv
- data/data_crawl/pipeline/artifacts/evaluation/q1_pairwise_group_tests.csv
- data/data_crawl/pipeline/artifacts/evaluation/q2q3_single_audit_no_pseudo_baseline_q2_aspect_metrics.csv
- data/data_crawl/pipeline/artifacts/evaluation/q2q3_single_audit_no_pseudo_baseline_q3_none_bias.csv
- data/data_crawl/pipeline/artifacts/evaluation/q2q3_single_audit_no_pseudo_baseline_q2q3_report.json

## Q1 - Sample selection quality
Sample error rate by group:
- fallback: 0.8500 (51/60)
- hard: 0.8257 (1734/2100)
- medium: 0.7633 (432/566)
- random: 0.7044 (193/274)

Pairwise significance (sample error rate):
- hard vs random: p = 2.0369e-06 (significant)
- hard vs medium: p = 9.0628e-04 (significant)
- fallback vs random: p = 3.2191e-02 (significant)
- medium vs random: p = 8.0343e-02 (not significant at 0.05)

Interpretation:
- The selection strategy is successfully concentrating more difficult/noisy samples in hard/fallback than random.
- This is a positive sign for active-labeling prioritization.

## Q2 - Absolute model quality (single-system)
Overall:
- macro_f1: 0.7299
- micro_f1: 0.7564

Aspect macro F1:
- location: 0.7430
- cleanliness: 0.7411
- food_drinks: 0.7401
- service: 0.7363
- rooms: 0.7251
- hotel: 0.5723

Interpretation:
- Overall quality is moderate.
- Hotel aspect is a clear weak point and drags global performance.

## Q3 - None-bias audit
None overprediction ratio:
- service: 1.4977
- cleanliness: 1.4388
- location: 1.2315
- rooms: 1.1229
- food_drinks: 0.9634
- hotel: 0.5468

Interpretation:
- The system over-predicts none in several aspects (especially service/cleanliness/location).
- This explains missed non-none labels and limits recall on informative aspects.

## Final decision: Is the current sample-selection strategy good enough?
Decision: PARTIALLY YES.

Why:
- YES for targeting: Q1 confirms selected groups are meaningfully harder than random.
- NOT YET for final quality: Q2/Q3 indicate quality and bias issues remain (especially hotel aspect and none overprediction).

Recommended next actions:
1. Keep current selection strategy (hard + fallback + uncertain bands), because targeting works.
2. Increase human labeling share for hotel/service/cleanliness hard cases.
3. Add anti-none constraints in relabeling prompts/post-rules for service/cleanliness/location.
4. Re-run this same Q1/Q2/Q3 audit after each relabel batch and track trend over time.
