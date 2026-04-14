## Mục tiêu

Chuẩn hóa và làm sạch dữ liệu sau khi pseudo-label để tạo dataset chất lượng cao cho Model 2.

- Tập validation của VLSP được đánh nhãn bằng model: /data/data_crawl/output_dev.csv
- Tập data tự crawl chưa được đánh nhãn: /data/data_crawl/reviews_cleaned.csv
- Tập data tự crawl được đánh nhãn bằng model: /data/data_crawl/output_results.csv

---

# Skill 1: Confidence-Based Thresholding

## Mục tiêu

Chọn ra các sample đáng tin cậy từ pseudo-label dựa trên validation set.

## Input

- Với mỗi aspect:  
  - label_true  
  - label_pred  
  - prob (xác suất dự đoán)

## Quy trình

### Bước 1: Tính confidence tổng

- conf_mean: trung bình prob của tất cả aspect  
- conf_min: giá trị prob nhỏ nhất trong các aspect  

---

### Bước 2: Quét threshold

- Thử các ngưỡng: 0.7, 0.75, 0.8, 0.85  

- Với mỗi threshold:
  - Giữ các sample có `conf_mean ≥ threshold`
  - So sánh `label_pred` với `label_true`
  - Tính F1 score

---

### Bước 3: Chọn threshold

- Chọn threshold cho F1 cao nhất  
- Nếu các giá trị gần nhau → chọn threshold cao hơn để đảm bảo chất lượng  

---

### Bước 4: Áp dụng lên data crawl

- Áp dụng:
  - `conf_mean ≥ threshold`
  - `conf_min ≥ 0.5` (đảm bảo không có aspect quá yếu)

---

# Skill 2: Noise Detection & Removal

## Mục tiêu

Loại bỏ các sample có khả năng sai hoặc không đáng tin.

## Rules

1. Full none

- Nếu tất cả aspect = none → cân nhắc loại bỏ  
- Lý do:
  - Không đóng góp thông tin sentiment  
  - Dễ làm model bias về none  

- Gợi ý:
  - Chỉ giữ lại một phần nhỏ (20–30%) để giữ phân phối  

---

2. All same sentiment

- Tất cả aspect đều positive hoặc đều negative  
- Lý do:
  - Trong thực tế hiếm khi tất cả khía cạnh giống nhau  
  - Có khả năng model đang đoán quá đơn giản  

---

3. Confidence không đồng đều

- Có ít nhất 1 aspect có confidence thấp (dưới 0.5)  
- Lý do:
  - Chỉ cần 1 aspect sai có thể làm hỏng toàn bộ sample  

---

4. Sample quá đơn giản hoặc bất thường

- Câu quá ngắn, không rõ nghĩa  
- Nội dung không liên quan đến domain  
- Lý do:
  - Model dễ đoán bừa, không mang thông tin học được  

---

5. Vùng sát threshold

- Các sample có `conf_mean` gần threshold (ví dụ 0.75–0.8)  
- Không dùng để train  
- Đưa vào pool để label tay  

---

# Skill 3: Human Labeling (10%)

## Mục tiêu

Bổ sung dữ liệu chất lượng cao (ground truth) để sửa lỗi của pseudo-label.

## Cách chọn sample

1. Nhóm uncertain

- Sample có `conf_mean` gần threshold  
- Đây là vùng model dễ sai nhất  

---

2. Nhóm conflict

- Sample có cả positive và negative giữa các aspect  
- Đây là các trường hợp phức tạp, có giá trị học cao  

---

3. Nhóm đại diện

- Một phần nhỏ sample chọn ngẫu nhiên  
- Đảm bảo dữ liệu đa dạng, tránh bias  

---

## Guideline gán nhãn

- Label theo từng aspect, không theo cảm xúc chung của câu  

- 3 nhãn:
  - positive: có khen rõ ràng  
  - negative: có chê rõ ràng  
  - none: không đề cập  

---

## Quy tắc quan trọng

- Nếu không chắc chắn → chọn none  
- Không suy đoán ngoài nội dung  
- Một câu có thể có nhiều sentiment khác nhau theo từng aspect  

---

## Ví dụ

- "đồ ăn ngon nhưng phục vụ tệ"  
  - food: positive  
  - service: negative  

- "quán ổn"  
  - tất cả aspect: none  

---

# Skill 4: Data Integration

## Input

- VLSP (ground truth, ~3k)  
- Data crawl (pseudo-label, ~30k)  
- Data label tay (~10% từ crawl)  

---

## Cách merge

- Gộp tất cả vào một dataset chung  
- Thêm cột `source`:
  - real (VLSP)  
  - pseudo (crawl)  
  - human (label tay)  

---

## Lý do

- Pseudo giúp tăng số lượng và độ đa dạng  
- VLSP giữ độ chính xác chuẩn  
- Human giúp sửa bias và lỗi hệ thống  

---

# Skill 5: EDA & Validation

## Mục tiêu

Đảm bảo dataset sau khi xử lý là hợp lý và ổn định.

## Cần kiểm tra

1. Phân phối label

- Tỷ lệ positive / negative / none  
- Tránh lệch quá mạnh về một class  

---

2. Phân phối theo aspect

- Mỗi aspect có đủ dữ liệu không  
- Có aspect bị bias không  

---

3. Phân phối confidence

- Có quá nhiều sample gần threshold không  
- Nếu có → dữ liệu chưa đủ sạch  

---

4. Kiểm tra sample bất thường

- Câu quá ngắn hoặc vô nghĩa  
- Label không khớp với nội dung  

---

5. So sánh giữa các nguồn

- Pseudo vs VLSP vs Human  
- Kiểm tra sự khác biệt phân phối  

---

# Workflow tổng

1. Dùng VLSP validation để chọn threshold  
2. Áp dụng threshold lên data crawl  
3. Lọc noise bằng rule-based  
4. Chọn 10% sample để label tay  
5. Merge các nguồn dữ liệu  
6. Kiểm tra bằng EDA  
7. Train Model 2  

---

# Outcome

- Dataset sạch và đáng tin cậy  
- Giảm noise từ pseudo-label  
- Tăng hiệu quả cho Model 2