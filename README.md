# ML-23KHDL1-Lab

Repository for Vietnamese hotel **Aspect-Based Sentiment Analysis (ABSA)**, including data collection/cleaning pipelines, multiple model implementations, and a demo application.

> This project is primarily a **model/data repo**. The app exists for demonstration/integration and is secondary.

## 1) Repository Focus

Main research target:
- Multi-aspect sentiment classification on hotel reviews
- 6 aspects:
  - `vệ sinh`
  - `đồ ăn thức uống`
  - `khách sạn`
  - `vị trí`
  - `phòng ốc`
  - `dịch vụ`
- 3 sentiment classes per aspect:
  - `0`: none/not mentioned
  - `1`: positive
  - `2`: negative

## 2) Repository Layout

```text
ML-23KHDL1-Lab/
├── models/
│   ├── model_videberta_fine-tune/       # ViDeBERTa + adapters + multipool + MSD
│   ├── Model_phobert+gru_finetune/      # PhoBERT + BiGRU multi-head pipeline
│   └── model_svm/                        # SVM baseline notebook + exported model
├── src/
│   ├── Model_gan_nhan/                   # Legacy/extended PhoBERT 3-class pipeline
│   └── scrapy_data/                      # Crawling scripts for metadata/reviews
├── data/
│   ├── dataset_vlsp/                     # VLSP hotel ABSA data (processed files)
│   └── data_crawl/                       # Crawl outputs + filtering/relabel artifacts
├── application/
│   ├── backend/                          # Express API (JWT/API key + PostgreSQL)
│   ├── frontend/                         # React + Vite + Tailwind UI
│   └── app.py                            # FastAPI wrapper for model inference
└── tools/
    └── human-label-editor/               # Labeling support tool
```

## 3) Model Implementations

### A. ViDeBERTa fine-tuning (primary modern pipeline)
Path: `models/model_videberta_fine-tune/`

Key files:
- `train.py`: training loop with early stopping by validation macro-F1
- `videberta_msd.py`: model (encoder + adapters + multipool + MSD)
- `evaluate.py`: test evaluation from checkpoint
- `infer.py`: single-text and batch inference
- `config.py`: paths, aspects, and hyperparameters

Core characteristics:
- Backbone: `Fsoft-AIC/videberta-base`
- 6 shared aspect heads (3-class each)
- Adapter-based fine-tuning
- Multi-pooling (CLS + mean + max)
- Multi-sample dropout (MSD)
- Class-weighted + smoothed cross-entropy per aspect

Typical usage:
```bash
cd models/model_videberta_fine-tune
python train.py
python evaluate.py --checkpoint ../best.pt
python infer.py --text "Khách sạn sạch sẽ, nhân viên thân thiện"
```

### B. PhoBERT + BiGRU fine-tuning
Path: `models/Model_phobert+gru_finetune/`

Key files:
- `training.py`
- `evaluate.py`
- `download_model.py` (download/save local PhoBERT)

### C. Legacy PhoBERT 3-class workflow
Path: `src/Model_gan_nhan/`

Key files:
- `process_3class.py`: preprocess/map labels
- `train_v2_hygiene_3class.py`: train model
- `inference_3class.py`: pseudo-label/inference
- `requirements.txt`

### D. SVM baseline
Path: `models/model_svm/SVM_Baseline.ipynb`

## 4) Data and Labeling Pipeline

Main data areas:
- VLSP processed files: `data/dataset_vlsp/`
- Crawled review pipeline + artifacts: `data/data_crawl/pipeline/`
  - threshold calibration
  - noisy-sample filtering
  - relabel pool generation
  - human-label preparation
  - final train/val/test merge artifacts

Important scripts:
- `data/data_crawl/pipeline/scripts/step1_calibrate_threshold.py`
- `data/data_crawl/pipeline/scripts/step2_filter_results.py`
- `data/data_crawl/pipeline/scripts/step3_noise_filter_and_relabel_pool.py`
- `data/data_crawl/pipeline/scripts/step4_prepare_human_label_template.py`
- `data/data_crawl/pipeline/scripts/step4_relabel_independent_text.py`
- `data/data_crawl/pipeline/scripts/step5_merge_crawl_only_dataset.py`

## 5) Model Environment Setup

Example Python setup:
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -U pip
pip install pandas numpy torch transformers datasets scikit-learn tqdm vncorenlp
```

If you run the legacy pipeline in `src/Model_gan_nhan/`:
```bash
pip install -r src/Model_gan_nhan/requirements.txt
```

## 6) Application (Secondary)

### Backend (`application/backend`)
- Node.js + Express
- JWT + API key middleware
- PostgreSQL via `pg`

```bash
cd application/backend
npm ci
cp .env.example .env
npm run dev
```

### Frontend (`application/frontend`)
- React + Vite + Tailwind

```bash
cd application/frontend
npm ci
cp .env.example .env
npm run dev
```

## 7) Current Validation Notes

- Frontend build works (`npm run build`).
- Frontend lint currently reports pre-existing issues in:
  - `src/components/LoginModal.jsx`
  - `src/context/AuthContext.jsx`
- Backend starts after installing dependencies and loading `.env`.

## 8) Recommended Starting Point

If your goal is model work, start here:
1. Prepare/inspect data in `data/data_crawl/pipeline/`.
2. Train/evaluate in `models/model_videberta_fine-tune/`.
3. Use `infer.py` or `application/app.py` for inference serving.
