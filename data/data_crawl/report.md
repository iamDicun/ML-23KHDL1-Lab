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

