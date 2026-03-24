# Hướng dẫn chạy Mô hình PhoBERT - ABSA (3-Class Hygiene)

Đây là kho lưu trữ chứa toàn bộ mã nguồn của mô hình phân tích cảm xúc khía cạnh (Aspect Based Sentiment Analysis) sử dụng kiến trúc lõi **PhoBERT**. Mô hình đã được tinh chỉnh theo hướng quy hoạch **6 khía cạnh chính (Hygiene)** và rút gọn nhãn học máy xuống **3 lớp (Tích cực, Tiêu cực, Không đề cập)**.

## Yêu cầu hệ thống (Prerequisites)
- **Python**: Khuyến nghị phiên bản 3.9 - 3.11
- **Java (JRE/JDK)**: Bắt buộc phải có để chạy thư viện VnCoreNLP (cắt từ tiếng Việt). Yêu cầu Java 8 trở lên.
- **Card Đồ Họa (GPU)**: Khuyến nghị sử dụng NVIDIA GPU có CUDA (VRAM tối thiểu 8GB) để chạy sửa lỗi chính tả bằng AI và huấn luyện PhoBERT.

---

## Bước 1: Thiết lập môi trường (Environment Setup)

Khuyến nghị sử dụng môi trường ảo (Virtual Environment) để tránh xung đột thư viện.

1. **Tạo môi trường ảo:**
   Mở terminal tại thư mục `Model_1` và chạy lệnh sau:
   ```bash
   python -m venv venv
   ```

2. **Kích hoạt môi trường ảo:**
   - Trên **Windows**:
     ```bash
     .\venv\Scripts\activate
     ```
   - Trên **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

3. **Cài đặt các thư viện cần thiết:**
   Cài đặt bộ thư viện machine learning và xử lý ngôn ngữ tự nhiên:
   ```bash
   pip install -r requirements.txt
   ```
   *(Lưu ý: Với PyTorch, nếu bạn dùng GPU, hãy truy cập [trang chủ PyTorch](https://pytorch.org/) để lấy lệnh cài đặt PyTorch hỗ trợ GPU CUDA phù hợp với máy của bạn thay vì dùng bản mặc định).*

---

## Bước 2: Xử lý & Chuẩn hóa dữ liệu (Data Preprocessing)

Trước khi huấn luyện hoặc dự đoán, bạn cần xử lý làm sạch dữ liệu. Chúng ta có hai tập dữ liệu cần xử lý riêng:

**1. Xử lý tập huấn luyện VLSP 2018 (34 lớp -> 6 lớp):**
Chạy lệnh gốc dưới đây để hệ thống gom 34 thuộc tính phân mảnh của VLSP về đúng 6 hệ Hygiene, đồng thời ép hệ nhãn nhiễu về hệ 3-Class tiêu chuẩn (1, 2, 0).
```bash
python process_3class.py
```
Dữ liệu đầu ra sẽ được lưu tại `data/processed_datasets_3class/`.

**2. Làm sạch lượng lớn dữ liệu thực tế (Inference Data):**
Đối với tập 35k dữ liệu nhiễu chưa dán nhãn, chạy pipeline cắt từ (VnCoreNLP), chuẩn hóa Teencode và sửa lỗi chính tả AI tự động:
```bash
cd processors
python run_process_hygiene_3class.py
cd ..
```
Dữ liệu đầu ra sạch sẽ được lưu tại `data/cleaned/`.

---

## Bước 3: Huấn luyện mô hình (Training)

Sau khi bộ dữ liệu mẫu VLSP đã được cắt tỉa, ta sẽ tiến hành đào tạo (fine-tune) PhoBERT đóng vai trò gán nhãn tự động.

Chạy lệnh:
```bash
python train_v2_hygiene_3class.py
```
Trong quá trình chạy, mô hình sử dụng hàm **Focal Loss** tùy chỉnh để ép trị các mẫu Tiêu cực thiểu số. Các Checkpoint tốt nhất sẽ được hệ thống lưu cục bộ vào thư mục do cấu hình `TrainingArguments` chỉ định (bạn nhớ copy checkpoint tốt nhất sang thư mục `model_weights/` cho bước sau).

---

## Bước 4: Chạy dự đoán thực tế (Inference)

Khi đã có mô hình chất lượng cực tốt, chúng ta dùng nó để gán nhãn (pseudo-labeling) ngược lại cho 35.000 dữ liệu đánh giá thực tế thu thập ban đầu.

1. Hãy mở `inference_3class.py` bằng trình soạn thảo mã.
2. Kiểm tra/chỉnh sửa biến `checkpoint_path` trỏ đúng vào thư mục model checkpoint bạn vừa train ở Bước 3.
3. Chạy lệnh:
```bash
python inference_3class.py
```

Code sẽ đẩy dữ liệu thành dạng stream xuống Pytorch và card đồ họa. Tiến trình quét với thanh load (tqdm) sẽ hiển thị.
Kết quả đánh giá và xuất csv cuối cùng sẽ lưu trong thư mục `output/output_results_3class.csv`. Tập dữ liệu này sẵn sàng cho mọi nghiên cứu tiếp theo của dự án!
