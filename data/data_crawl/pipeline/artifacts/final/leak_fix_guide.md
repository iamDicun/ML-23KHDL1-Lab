# Huong dan xu ly data leak do review trung noi dung

## 1) Van de
Data leak xay ra khi cung mot noi dung review xuat hien o nhieu tap train/val/test.
Dieu nay lam ket qua danh gia mo hinh bi lac quan hon thuc te.

## 2) Muc tieu
- Loai bo review trung noi dung trong tap full.
- Chia lai train/val/test de dam bao khong con giao nhau theo noi dung review.
- Giu ti le chia goc 70/20/10 va tao ket qua co the tai lap.

## 3) Quy trinh da ap dung (2026-04-10)
1. Backup toan bo file truoc khi xu ly:
   - crawl_only_merged_full.csv
   - crawl_only_train.csv
   - crawl_only_val.csv
   - crawl_only_test.csv
   - crawl_only_merge_summary.json
2. Chon cot noi dung dedup: Review.
3. Chuan hoa noi dung review de so trung:
   - strip dau/cuoi
   - lower-case
   - gop nhieu khoang trang lien tiep thanh 1 khoang trang
4. Drop duplicate tren tap full theo Review da chuan hoa, keep first.
5. Shuffle full sau dedup voi random_seed = 42.
6. Chia lai train/val/test theo ti le cu 70/20/10.
7. Ghi de 4 file full/train/val/test.
8. Validate sau chia:
   - duplicate noi bo tung tap = 0
   - overlap train-val = 0
   - overlap train-test = 0
   - overlap val-test = 0

## 4) So lieu truoc/sau
- Truoc dedup:
  - rows_full = 19120
  - duplicate_rows_by_review = 229
- Sau dedup:
  - rows_full = 18891
  - rows_removed = 229
- Split moi:
  - rows_train = 13224
  - rows_val = 3778
  - rows_test = 1889

## 5) Duong dan artifact lien quan
- Full sau xu ly:
  - data/data_crawl/pipeline/artifacts/final/crawl_only_merged_full.csv
- Split sau xu ly:
  - data/data_crawl/pipeline/artifacts/final/crawl_only_train.csv
  - data/data_crawl/pipeline/artifacts/final/crawl_only_val.csv
  - data/data_crawl/pipeline/artifacts/final/crawl_only_test.csv
- Summary tong:
  - data/data_crawl/pipeline/artifacts/final/crawl_only_merge_summary.json
- Summary dedup theo timestamp:
  - data/data_crawl/pipeline/artifacts/final/crawl_only_dedup_summary_20260410_161353.json
- Backup truoc khi ghi de:
  - data/data_crawl/pipeline/artifacts/final/backup_before_dedup_20260410_161353/

## 6) Mau code toi gian de tai su dung
Luu y: doan code duoi day la mau tham khao, can dieu chinh path theo moi truong.

```python
import pandas as pd

# 1) Load
df = pd.read_csv("crawl_only_merged_full.csv")

# 2) Normalize review text
review_norm = (
    df["Review"].astype(str)
    .str.strip()
    .str.lower()
    .str.replace(r"\\s+", " ", regex=True)
)

# 3) Dedup full
keep_mask = ~review_norm.duplicated(keep="first")
df_full = df.loc[keep_mask].reset_index(drop=True)

# 4) Shuffle reproducible
df_full = df_full.sample(frac=1.0, random_state=42).reset_index(drop=True)

# 5) Resplit 70/20/10
n = len(df_full)
n_train = int(round(n * 0.7))
n_val = int(round(n * 0.2))
train = df_full.iloc[:n_train].copy()
val = df_full.iloc[n_train:n_train + n_val].copy()
test = df_full.iloc[n_train + n_val:].copy()

# 6) Save
train.to_csv("crawl_only_train.csv", index=False)
val.to_csv("crawl_only_val.csv", index=False)
test.to_csv("crawl_only_test.csv", index=False)
```

## 7) Checklist truoc khi train lai
- Xac nhan split_sum == full_rows.
- Xac nhan duplicate noi bo cua train/val/test deu bang 0.
- Xac nhan overlap theo Review giua cac cap split deu bang 0.
- Chot random_seed de cac lan chay sau cho ket qua giong nhau.
