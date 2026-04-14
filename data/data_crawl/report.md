# Report: Pseudo-label Quality Control (Step 1 -> Step 3)

## 1. Mục tiêu

Sau khi Model 1 gán nhãn dữ liệu crawl, mục tiêu là:

1. Chọn ngưỡng confidence tối ưu trên validation có ground truth.
2. Lọc dữ liệu pseudo-label để giảm nhiễu cho train.
3. Tách một relabel pool 3k mẫu khó trước bước Human Labeling chính thức.

## 2. Tổ chức thư mục (reorganized)

Pipeline được chuẩn hóa theo step để dễ mở rộng và truy vết:

- `data/data_crawl/pipeline/scripts/`
  - `step1_calibrate_threshold.py`
  - `step2_filter_results.py`
  - `step3_noise_filter_and_relabel_pool.py`
- `data/data_crawl/pipeline/artifacts/step1/`
- `data/data_crawl/pipeline/artifacts/step2/`
- `data/data_crawl/pipeline/artifacts/step3/`

Input gốc vẫn giữ ở `data/data_crawl/`:

- `output_dev.csv`
- `output_results.csv`

## 3. Định nghĩa confidence

Với mỗi sample gồm 6 xác suất aspect `p1..p6`:

- `conf_mean = mean(p1..p6)`
- `conf_min = min(p1..p6)`

`conf_mean` phản ánh độ chắc chắn trung bình toàn sample.
`conf_min` bảo vệ aspect yếu nhất, tránh train trên nhãn có điểm yếu cục bộ.

## 4. Step 1 - Threshold Calibration

Quét ngưỡng `0.70, 0.75, 0.80, 0.85` trên `output_dev.csv`:

- Giữ mẫu có `conf_mean >= threshold`
- So sánh `label_pred` với `label_true`
- Tính `F1-macro`, `F1-micro`

Kết quả:

| Threshold | Kept rows | Kept ratio | F1-macro | F1-micro |
|---|---:|---:|---:|---:|
| 0.70 | 1957 | 0.9785 | 0.8451 | 0.8838 |
| 0.75 | 1866 | 0.9330 | 0.8522 | 0.8905 |
| 0.80 | 1558 | 0.7790 | 0.8635 | 0.9037 |
| 0.85 | 896 | 0.4480 | 0.8872 | 0.9295 |

Chọn `threshold_best = 0.85` theo quy tắc: F1-macro cao nhất, và ưu tiên ngưỡng cao khi cần độ sạch dữ liệu.

## 5. Step 2 - Confidence Filtering

Điều kiện giữ mẫu:

- `conf_mean >= 0.85`
- `conf_min >= 0.5`

Kết quả:

- Trước filter: 35183
- Sau filter: 17295
- Bị loại: 17888
- Retention: 49.16%

Biến động confidence:

- `conf_mean` mean: `0.8416 -> 0.8869`
- `conf_min` mean: `0.6854 -> 0.7814`

Giải thích `conf_min >= 0.5`:

1. Chặn trường hợp trung bình cao giả tạo khi còn một aspect rất yếu.
2. Huấn luyện đa aspect nhạy với lỗi cục bộ; chỉ một aspect sai cũng gây nhiễu gradient.
3. Đây là "sàn an toàn" để tránh đưa vào train các mẫu có xác suất gần ngẫu nhiên ở ít nhất một khía cạnh.

Lưu ý cho các bước sau: toàn bộ mẫu bị loại Step 2 đã được lưu riêng và giữ lại, không xóa.

## 6. Step 3 - Rule-based Noise Filtering

Input: tập đã giữ từ Step 2 (`17295` mẫu).

Các luật lọc nhiễu:

1. `rule_full_none`: tất cả aspect = 0.
2. `rule_all_same_pos`: tất cả aspect = 1.
3. `rule_all_same_neg`: tất cả aspect = 2.
4. `rule_text_too_short`: review quá ngắn (`token < 4` hoặc `char < 15`).

Kết quả Step 3:

- Input Step 3: 17295
- Keep Step 3: 16309
- Remove Step 3: 986
- Retention Step 3: 94.30%

Đếm theo luật:

- `rule_full_none`: 731
- `rule_all_same_pos`: 102
- `rule_all_same_neg`: 0
- `rule_text_too_short`: 158

Biến động confidence trước/sau Step 3:

- `conf_mean` mean: `0.886866 -> 0.887279`
- `conf_min` mean: `0.781388 -> 0.782985`

## 7. Bước chen giữa trước Human Labeling: Relabel Pool 3k

Yêu cầu: mẫu bị loại ở Step 2 và Step 3 phải được giữ lại, sau đó chọn khoảng 3k mẫu để label tay tập trung vào vùng khó.

Đã triển khai pool 3000 mẫu với rule:

1. Hard sample (~70%):
	- `conf_mean` trong vùng khó `0.75-0.8` HOẶC
	- `conf_min` thấp (`< 0.6`)
2. Medium conf (~20%):
	- `conf_mean` trong `0.8-0.9`
3. Random (~10%):
	- Lấy ngẫu nhiên từ mẫu biên đã bị loại và một phần mẫu được giữ

Kết quả thực tế relabel pool:

- Tổng mẫu: **3000**
- Thành phần:
  - hard: 2100
  - medium: 566
  - random: 274
  - fallback: 60

Ghi chú về `fallback`: do trùng lặp và giới hạn dữ liệu ở một số bucket, script tự bù từ tập còn lại để đảm bảo đủ 3000 mẫu. Cách này giữ đúng mục tiêu số lượng và vẫn ưu tiên mạnh cho vùng khó.

## 8. Tác động phương pháp

Giữ lại và relabel mẫu khó bị lọc giúp tránh hiện tượng mô hình "ngu đi" theo nghĩa:

1. Không bị overfit chỉ trên mẫu dễ (high-confidence sạch).
2. Bổ sung phản hồi người thật cho vùng decision boundary.
3. Giảm bias do pseudo-label sai có hệ thống ở các trường hợp mơ hồ hoặc xung đột sentiment.

## 9. Artifacts hiện có

Step 1:

- `pipeline/artifacts/step1/step1_threshold_scan.csv`
- `pipeline/artifacts/step1/step1_best_threshold.json`

Step 2:

- `pipeline/artifacts/step2/output_results_scored_step2.csv`
- `pipeline/artifacts/step2/output_results_filtered_step2.csv`
- `pipeline/artifacts/step2/output_results_removed_step2.csv`
- `pipeline/artifacts/step2/step2_filter_summary.json`
- `pipeline/artifacts/step2/step2_label_shift.csv`

Step 3:

- `pipeline/artifacts/step3/output_results_scored_step3.csv`
- `pipeline/artifacts/step3/output_results_filtered_step3.csv`
- `pipeline/artifacts/step3/output_results_removed_step3.csv`
- `pipeline/artifacts/step3/step3_filter_summary.json`
- `pipeline/artifacts/step3/relabel_pool_3k_step3.csv`
- `pipeline/artifacts/step3/relabel_pool_3k_summary.json`

## 10. Kết luận giai đoạn

- Threshold tối ưu vẫn là `0.85`.
- Sau Step 2 + Step 3, dữ liệu train pseudo-label đã sạch hơn và ổn định hơn.
- Toàn bộ mẫu bị loại Step 2/3 đã được giữ lại có kiểm soát.
- Đã có relabel pool 3000 mẫu theo chiến lược hard/medium/random để đi vào Human Labeling hiệu quả.

## 11. Cách chạy kiểm chứng 3 câu hỏi (đã triển khai script)

### 11.1. Chuẩn bị file human-label (Q1)

Đã tạo script:

- `pipeline/scripts/step4_prepare_human_label_template.py`

Lệnh chạy:

```powershell
& .\.venv\Scripts\python.exe data/data_crawl/pipeline/scripts/step4_prepare_human_label_template.py
```

Output:

- `pipeline/artifacts/step4/relabel_pool_3k_human_template_minimal.csv` (file cho annotator)
- `pipeline/artifacts/step4/relabel_pool_3k_eval_reference.csv` (file tham chiếu nội bộ để đánh giá)

Annotator điền các cột:

- `human_vệ sinh_label`
- `human_đồ ăn thức uống_label`
- `human_khách sạn_label`
- `human_vị trí_label`
- `human_phòng ốc_label`
- `human_dịch vụ_label`

Template tối giản hiện còn 11 cột (đủ để label, không dư):

- `review_id`, `Review`, `relabel_group`
- 6 cột `human_*_label`
- `annotator_id`, `annotation_note`

### 11.2. Trả lời Q1: Hard có khó hơn Medium/Random không?

Script:

- `pipeline/scripts/evaluate_q1_sample_selection.py`

Lệnh chạy sau khi có nhãn tay:

```powershell
& .\.venv\Scripts\python.exe data/data_crawl/pipeline/scripts/evaluate_q1_sample_selection.py
```

Script sẽ tự động:

- đọc nhãn tay từ `relabel_pool_3k_human_template_minimal.csv`
- merge pseudo-label tham chiếu từ `relabel_pool_3k_eval_reference.csv`

Output:

- `pipeline/artifacts/evaluation/q1_group_error_summary.csv`
- `pipeline/artifacts/evaluation/q1_pairwise_group_tests.csv`
- `pipeline/artifacts/evaluation/q1_report.json`

Tiêu chí đạt:

- `sample_error_rate(hard) > sample_error_rate(medium) > sample_error_rate(random)`
- kiểm định cặp có `p_value < 0.05`

### 11.3. Trả lời Q2 + Q3: 3k human labels có giúp mô hình và giảm bias none không?

Script:

- `pipeline/scripts/evaluate_q2_q3_model_impact.py`

Input cần có 2 file dự đoán:

- Baseline (trước thêm 3k)
- Enhanced (sau thêm 3k)

Mỗi file cần các cột:

- `review_id`
- Với mỗi aspect, có cặp cột `*_true` và `*_pred`
  - ví dụ: `vệ sinh_true`, `vệ sinh_pred`
  - tương tự cho các aspect còn lại

Lệnh chạy:

```powershell
& .\.venv\Scripts\python.exe data/data_crawl/pipeline/scripts/evaluate_q2_q3_model_impact.py --baseline path/to/baseline_predictions.csv --enhanced path/to/enhanced_predictions.csv --output-prefix model_compare
```

Output:

- `pipeline/artifacts/evaluation/model_compare_q2_aspect_comparison.csv`
- `pipeline/artifacts/evaluation/model_compare_q3_none_bias_comparison.csv`
- `pipeline/artifacts/evaluation/model_compare_q2q3_report.json`

Tiêu chí đạt:

- Q2: `delta_macro_f1 > 0` overall và đa số aspect có `delta_macro_f1 > 0`
- Q3: `none_overprediction_ratio` tiến gần 1 hơn hoặc không tăng lệch; `none_f1` không đánh đổi bằng tụt mạnh lớp còn lại

## 12. Cập nhật đánh giá mới nhất (trường hợp không có pseudo gốc)

### 12.1. Bối cảnh đánh giá

- Với dữ liệu crawl hiện tại, không có snapshot pseudo gốc theo phiên bản để so sánh before/after.
- Vì vậy Q2 được chạy theo chế độ **single-system audit** (đánh giá chất lượng tuyệt đối của hệ hiện tại so với nhãn tay), thay vì so baseline-enhanced delta.

Artifacts mới:

- `pipeline/artifacts/evaluation/q1_group_error_summary.csv`
- `pipeline/artifacts/evaluation/q1_pairwise_group_tests.csv`
- `pipeline/artifacts/evaluation/q2q3_single_audit_no_pseudo_baseline_q2_aspect_metrics.csv`
- `pipeline/artifacts/evaluation/q2q3_single_audit_no_pseudo_baseline_q3_none_bias.csv`
- `pipeline/artifacts/evaluation/q2q3_single_audit_no_pseudo_baseline_q2q3_report.json`
- `pipeline/artifacts/evaluation/q123_audit_report_no_pseudo_baseline.md`
- `pipeline/artifacts/evaluation/q123_audit_report_no_pseudo_baseline.json`

### 12.2. Kết quả Q1 (kiểm tra chất lượng chọn mẫu)

Sample error rate theo nhóm:

- fallback: `0.8500`
- hard: `0.8257`
- medium: `0.7633`
- random: `0.7044`

Kiểm định cặp chính:

- hard vs random: `p = 2.0369e-06` (có ý nghĩa)
- hard vs medium: `p = 9.0628e-04` (có ý nghĩa)
- fallback vs random: `p = 3.2191e-02` (có ý nghĩa)

Kết luận Q1:

- Cách chọn mẫu hiện tại **đang bắt đúng vùng khó** (hard/fallback khó hơn random).

### 12.3. Kết quả Q2 (chất lượng tuyệt đối hệ hiện tại)

Overall:

- macro F1: `0.7299`
- micro F1: `0.7564`

Aspect yếu nhất:

- `khách sạn` (macro F1 `0.5723`)

### 12.4. Kết quả Q3 (none-bias)

None overprediction ratio:

- dịch vụ: `1.4977`
- vệ sinh: `1.4388`
- vị trí: `1.2315`
- phòng ốc: `1.1229`
- đồ ăn thức uống: `0.9634`
- khách sạn: `0.5468`

Diễn giải:

- Hệ hiện tại còn xu hướng dự đoán `none` nhiều ở một số aspect (đặc biệt dịch vụ/vệ sinh/vị trí).

### 12.5. Kết luận tổng hợp về chiến lược chọn mẫu

- Kết luận: **Partially Yes**.
- Ý nghĩa:
  1. Ổn ở mục tiêu chọn mẫu khó (Q1 đạt tốt).
  2. Chưa ổn hoàn toàn ở chất lượng nhãn dự đoán và bias none (Q2/Q3 vẫn cần cải thiện).

## 13. Hướng merge dữ liệu (không merge với VLSP)

Theo bối cảnh hiện tại, hướng **không merge VLSP** là hợp lý nếu mục tiêu là tối ưu hóa cho domain crawl hiện tại.

### 13.1. Bộ file nên dùng để merge

1. Pseudo sạch để làm xương sống:
  - `pipeline/artifacts/step3/output_results_filtered_step3.csv`

2. Human-label để tăng chất lượng vùng khó:
  - `pipeline/artifacts/step4/human_label_v1.csv`

3. (Tuỳ chọn) pool theo dõi cho vòng sau, không đưa thẳng vào train:
  - `pipeline/artifacts/step3/relabel_pool_3k_step3.csv`
  - `pipeline/artifacts/step2/output_results_removed_step2.csv`
  - `pipeline/artifacts/step3/output_results_removed_step3.csv`

### 13.2. Quy tắc merge khuyến nghị

1. Chuẩn hóa schema về cùng bộ cột nhãn 6 aspect.
2. Gắn cột `source`:
  - `pseudo_step3_clean`
  - `human_relabel_pool`
3. Join theo `review_id` để phát hiện trùng giữa pseudo và human.
4. Nếu trùng `review_id`, **ưu tiên nhãn human** (override pseudo).
5. Loại các mẫu human còn thiếu nhãn ở bất kỳ aspect nào trước khi train.
6. Giữ một bảng audit riêng ghi rõ record nào bị override để truy vết.

### 13.3. Chia train/val nội bộ (không dùng VLSP)

1. Tách validation từ chính tập crawl đã merge (khuyến nghị stratify theo aspect label distribution).
2. Nếu có metadata khách sạn, ưu tiên split tránh leakage theo `hotel_id` (group-aware split).
3. Giữ nguyên một holdout nhỏ chỉ gồm mẫu hard/human để theo dõi tiến bộ theo vòng relabel.

## 14. Cách chạy Q2/Q3 theo mode mới

Script `evaluate_q2_q3_model_impact.py` đã hỗ trợ mode single-system audit:

```powershell
& .\.venv\Scripts\python.exe data/data_crawl/pipeline/scripts/evaluate_q2_q3_model_impact.py --input data/data_crawl/pipeline/artifacts/evaluation/q2q3_enhanced_from_output_results_no_v2.csv --output-prefix q2q3_single_audit_no_pseudo_baseline
```

Mode này phù hợp khi không có pseudo gốc để so baseline-enhanced.

## 15. Kết quả merge cuối cùng (crawl-only) và chia train/val/test = 7/2/1

Đã chạy merge thực tế theo hướng không dùng VLSP bằng script:

- `pipeline/scripts/step5_merge_crawl_only_dataset.py`

Nguồn merge:

1. Pseudo sạch: `pipeline/artifacts/step3/output_results_filtered_step3.csv`
2. Human-label: `pipeline/artifacts/step4/human_label_v1.csv`

Quy tắc áp dụng:

1. Giữ toàn bộ pseudo sạch làm xương sống.
2. Nếu `review_id` trùng với human-label thì override nhãn bằng human (`human_override`).
3. Nếu `review_id` chỉ có ở human-label thì thêm mới vào tập cuối (`human_only`).

File đầu ra hoàn chỉnh:

- `pipeline/artifacts/final/crawl_only_merged_full.csv`

File chia tập:

- `pipeline/artifacts/final/crawl_only_train.csv`
- `pipeline/artifacts/final/crawl_only_val.csv`
- `pipeline/artifacts/final/crawl_only_test.csv`

Summary:

- `pipeline/artifacts/final/crawl_only_merge_summary.json`

Số lượng sau merge:

- Full: `19120`
- Train: `13384` (0.7)
- Val: `3824` (0.2)
- Test: `1912` (0.1)

Thành phần nguồn nhãn trong full:

- `pseudo_step3_clean`: `16120`
- `human_only`: `2811`
- `human_override`: `189`

