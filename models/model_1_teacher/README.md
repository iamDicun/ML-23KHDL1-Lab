# Model 1 (Teacher) - Training Workspace

This folder centralizes all assets for Model 1, the first model used to auto-label data for Model 2.

## Folder Layout

- `train_model1.py`: Training entrypoint for PhoBERT multi-task aspect classification.
- `requirements.txt`: Python dependencies.
- `FINE_TUNING_STRATEGY.md`: Strategy to move from Model 1 to Model 2.
- `artifacts/` (created at runtime): Best checkpoint, tokenizer, metrics, and logs.

## Expected Dataset Schema

Training CSV must contain these columns:

- Text column: `Review`
- Label columns:
  - `FACILITIES`
  - `FOOD&DRINKS`
  - `HOTEL`
  - `LOCATION`
  - `ROOMS`
  - `SERVICE`

Label values are expected in `[0, 1, 2, 3, 4]`.

## Quick Start

From repository root:

```bash
# PowerShell (Windows)
& ".\.venv-1\Scripts\python.exe" -m pip install -r models/model_1_teacher/requirements.txt
& ".\.venv-1\Scripts\python.exe" models/model_1_teacher/train_model1.py --train-path data/dataset/final_processed_1-VLSP2018-SA-Hotel-train.csv --dev-path data/dataset/final_processed_2-VLSP2018-SA-Hotel-dev.csv --output-dir models/model_1_teacher/artifacts --epochs 4 --batch-size 16 --lr 2e-5

# Low-VRAM GPU profile (recommended for 4GB VRAM)
& ".\.venv-1\Scripts\python.exe" models/model_1_teacher/train_model1.py --train-path data/dataset/final_processed_1-VLSP2018-SA-Hotel-train.csv --dev-path data/dataset/final_processed_2-VLSP2018-SA-Hotel-dev.csv --output-dir models/model_1_teacher/artifacts --epochs 4 --batch-size 1 --grad-accum-steps 8 --max-len 128 --use-gradient-checkpointing --lr 2e-5

# Ultra low-VRAM mode (most stable on 4GB, trains only classification heads)
& ".\.venv-1\Scripts\python.exe" models/model_1_teacher/train_model1.py --train-path data/dataset/final_processed_1-VLSP2018-SA-Hotel-train.csv --dev-path data/dataset/final_processed_2-VLSP2018-SA-Hotel-dev.csv --output-dir models/model_1_teacher/artifacts --epochs 6 --batch-size 1 --grad-accum-steps 8 --max-len 128 --use-gradient-checkpointing --freeze-backbone --lr 2e-4

# If you prefer multi-line in PowerShell, use backtick (`) instead of backslash (\)
& ".\.venv-1\Scripts\python.exe" models/model_1_teacher/train_model1.py `
  --train-path data/dataset/final_processed_1-VLSP2018-SA-Hotel-train.csv `
  --dev-path data/dataset/final_processed_2-VLSP2018-SA-Hotel-dev.csv `
  --output-dir models/model_1_teacher/artifacts `
  --epochs 4 `
  --batch-size 16 `
  --lr 2e-5

# Bash/Git Bash
python models/model_1_teacher/train_model1.py \
  --train-path data/dataset/final_processed_1-VLSP2018-SA-Hotel-train.csv \
  --dev-path data/dataset/final_processed_2-VLSP2018-SA-Hotel-dev.csv \
  --output-dir models/model_1_teacher/artifacts \
  --epochs 4 \
  --batch-size 16 \
  --lr 2e-5
```

## Main Outputs

After training, `artifacts/` includes:

- `best_model.pt`: model weights and metadata.
- `tokenizer/`: saved tokenizer.
- `best_metrics.json`: best dev metrics (mean + each aspect).
- `train_log.jsonl`: epoch-level training history.

## Evaluate On Test Set

From repository root:

```bash
# PowerShell (Windows)
& ".\.venv-1\Scripts\python.exe" models/model_1_teacher/evaluate_model1.py --checkpoint-path models/model_1_teacher/artifacts/best_model.pt --test-path data/dataset/final_processed_3-VLSP2018-SA-Hotel-test.csv --output-json models/model_1_teacher/artifacts/test_metrics.json

# Bash/Git Bash
python models/model_1_teacher/evaluate_model1.py \
  --checkpoint-path models/model_1_teacher/artifacts/best_model.pt \
  --test-path data/dataset/final_processed_3-VLSP2018-SA-Hotel-test.csv \
  --output-json models/model_1_teacher/artifacts/test_metrics.json
```

This command prints and saves:

- `test_loss`
- `mean_macro_f1`
- Per-aspect metrics: `{ASPECT}_macro_f1`, `{ASPECT}_acc`

## Notes

- If `--dev-path` is not provided, script will split the train set into train/val.
- The checkpoint is selected by best `mean_macro_f1` on validation.
- For small GPUs, prefer `--batch-size 1 --grad-accum-steps 8 --max-len 128 --use-gradient-checkpointing`.
- If full fine-tuning still OOM, add `--freeze-backbone` and increase LR for heads (for example `--lr 2e-4`).
- This model is intended to produce pseudo labels for Model 2 training.
