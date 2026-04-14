## 1. Giới thiệu bài toán & Mục đích của dự án
- **Bài toán:** Phân tích cảm xúc đa khía cạnh (Aspect Based Sentiment Analysis - ABSA) trên bình luận khách sạn.
- **Mục tiêu mô hình hiện tại (PhoBERT):** Được huấn luyện đóng vai trò như một mô hình gán nhãn mẫu (Annotator/Pseudo-labeler) với độ tin cậy cao.
- **Mục đích chuỗi quy trình:** Mô hình PhoBERT này sẽ tự động gán nhãn cho tập dữ liệu thô lớn (~35.000 dòng đánh giá thực tế), nhằm tạo ra một bộ dữ liệu có nhãn hoàn chỉnh. Bộ dữ liệu khổng lồ này sau đó mới được sử dụng để tiến hành huấn luyện một mô hình học máy thứ hai ở giai đoạn sau của dự án. 

## 2. Phân tích & Xử lý Nguồn dữ liệu huấn luyện (VLSP 2018 Hotel)
Mô hình PhoBERT hiện tại được đào tạo từ bộ dữ liệu chuẩn VLSP 2018 Hotel. Quá trình xử lý dữ liệu gốc này là một bài toán **giảm chiều dữ liệu (Dimensionality Reduction)** phức tạp và được tinh chỉnh cẩn thận theo hướng **3-Class Hygiene**:

- **Khắc phục sự rải rác của 34 thuộc tính gốc:** Ban đầu, nhãn trong dữ liệu VLSP được phân mảnh quá chi tiết theo dạng "Thực thể#Thuộc tính" (tổng cộng khoảng 34 class độc lập như `ROOMS#CLEANLINESS`, `HOTEL#DESIGN`, `FOOD#QUALITY`...). Sự phân mảnh này tạo ra hiện tượng ma trận thưa cực kỳ nghiêm trọng, bởi một bình luận thực tế hiếm khi đánh giá đủ 34 khía cạnh. 
- **Cấu trúc lại thuộc tính (Gom nhóm xuống 6 khía cạnh chính):** Để giải quyết, dự án đã nén 34 lớp chi tiết về 6 nhóm lớn bám sát với insight khách hàng:
  - **`CLEANLINESS` (Vệ sinh):** Dùng kỹ thuật rà quét chéo để gom toàn bộ các cột có yếu tố vệ sinh từ mọi thực thể (Phòng, Khách sạn, Cơ sở vật chất...). Đây là yếu tố chí mạng nhất quyết định đánh giá tiêu cực của khách hàng.
  - **`HOTEL/ROOMS`:** Các thuộc tính chung chung chưa rõ ràng (như `FACILITIES`) được gộp vào `HOTEL`. Nhóm `ROOM_AMENITIES` được gộp chung với `ROOMS`. Đặc biệt, loại bỏ hoàn toàn các yếu tố vệ sinh khỏi nhóm này để tránh chồng chéo.
  - Khía cạnh **`FOOD&DRINKS`, `LOCATION`, `SERVICE`** được giữ nguyên do vốn mang tính độc lập rõ rệt.
- **Tiêu biến nhãn nhiễu:** Bên cạnh việc gom nhóm 34 khía cạnh xuống 6, hệ thống còn chuẩn hóa số lượng trạng thái cảm xúc. Dữ liệu gốc chứa quá nhiều loại nhãn cảm xúc phức tạp (Tích cực, Tiêu cực, Trung lập, Xung đột). Hệ thống đã áp dụng hàm thuật toán (`get_majority_label_strict_neg`) để ép nhãn chặt chẽ khi gom nhóm:
  - Bỏ biến `0` (Không nhắc đến).
  - So sánh tần suất nhãn Tích cực (1) và Tiêu cực (2) trong các cột con được gộp. Nếu số lượng bằng nhau hoặc thiên về Tiêu cực, thuật toán sẽ áp nhãn là Tiêu cực để ưu tiên bắt trọn các lỗi dịch vụ tế nhị nhất.
  - Kết quả chốt lại hệ nhãn rút gọn (3 class): **0 (Không đề cập), 1 (Tích cực), 2 (Tiêu cực)**.
- **Số liệu thống kê VLSP sau chuẩn hóa (3-Class):**
  - **Tập Train (18.000 nhãn):** Không đề cập (8852), Tích cực (6948), Tiêu cực (2200). Đóng vai trò cung cấp kiến thức chính.
  - **Tập Dev (12.000 nhãn):** Không đề cập (6625), Tích cực (3982), Tiêu cực (1393). Đóng vai trò đánh giá và thiết lập chốt chặn mốc hội tụ.
  - **Tập Test (3.600 nhãn):** Không đề cập (1722), Tích cực (1377), Tiêu cực (501). Đóng vai trò đánh giá hiệu suất của mô hình độc lập.
- **Hệ quả của viêc xử lý:** Sự luân chuyển khéo léo từ 34 class ma trận thưa xuống còn 6 macro-class với 3 class cảm xúc tinh gọn này đã triệt tiêu hoàn toàn độ nhiễu. Việc này ép mô hình PhoBERT học cực kỳ tập trung vào các vấn đề chính của khách sạn, để gắn nhãn cho lượng lớn dữ liệu unlabel đằng sau.

## 3. Phân tích khám phá dữ liệu (EDA) trên tập đích (Inference Dataset)
Tập dữ liệu đích thu thập được dùng để inference (gán nhãn) có những đặc điểm báo động cho thấy tại sao phải dùng mô hình mạnh để rà quét:
- **Kích thước mẫu:** Thu thập ~37.000 đánh giá thô, sau khi làm sạch (lọc nhiễu & câu < 5 từ) còn chính xác 35.183 đánh giá hợp lệ.
- **Thống kê điểm số:** Điểm trung bình rất cao, chạm mức 8.22 (độ lệch chuẩn 2.12), dải điểm từ 2.0 - 10.0.
- **Phân bố nhãn (Class Imbalance):** Mất cân bằng vô cùng nghiêm trọng, thiên lệch cực lớn về hướng tích cực.
  - *Tích cực:* Xảy ra áp đảo ở mức điểm 10.0 (13.333 mẫu), 9.0 (6.858 mẫu) và 8.0 (6.013 mẫu).
  - *Tiêu cực:* Rất thưa thớt, cụ thể mức điểm 2.0 (1.118 mẫu), 3.0 (672 mẫu) và 4.0 (1.278 mẫu).
- **Nhận định:** Chính vì dữ liệu hiếm hoi lời chê, nếu gán nhãn thủ công hoặc dùng rule-based sẽ dễ dàng bị nhiễu. PhoBERT sau khi huấn luyện trên hệ nhãn VLSP Strict-Negative sẽ tìm ra các khiếm khuyết tiêu cực cực kỳ chuẩn xác cho 35k dữ liệu này.

## 4. Quy trình làm sạch và tiền xử lý dữ liệu
Một Pipeline tiền xử lý văn bản tiếng Việt cực kỳ chuyên sâu (`VietnameseTextPreprocessor`) được xây dựng để chuẩn hóa cả tập dữ liệu VLSP 2018 gốc và 35k dữ liệu inference thu thập từ thực tế. Quy trình đi qua 5 lớp (layers) xử lý chặt chẽ:

- **Lớp 1 - Làm sạch cơ bản (Text Cleaning & Noise Removal):** Loại bỏ hoàn toàn các ký tự dư thừa và dữ liệu rác gây nhiễu cho mô hình. Cụ thể:
  - Bỏ các đánh giá quá ngắn (< 5 từ), trùng lặp hoặc chứa dữ liệu trống (NaN).
  - Sử dụng Regex để quét và xóa sạch mã HTML, Emoji, URL, Email, Số điện thoại và Hashtag.
  - Xóa bỏ các ký tự đặc biệt (chỉ giữ lại hệ ký tự tiếng Việt và chữ số cơ bản) và xóa khoảng trắng thừa.
- **Lớp 2 - Chuẩn hóa quy tắc gõ & Teencode (Tone & Teencode Normalization):**
  - Đồng nhất Unicode tiếng Việt (chuyển về chuỗi chuẩn dạng Unicode dựng sẵn).
  - Chuẩn hóa lại dấu thanh gõ sai vị trí (ví dụ: `hoà` hay `hòa` đều được quy về một chuẩn duy nhất).
  - Tích hợp một bộ từ điển `teencodes` (như `ks` -> `khách sạn`, `nv` -> `nhân viên`, `ko` -> `không`) kết hợp mapping từ vựng mạng xã hội tự động.
- **Lớp 3 - Sửa lỗi chính tả bằng AI (Spelling Correction with Seq2Seq):**
  - **Công nghệ chính:** Tích hợp mô hình `bmd1905/vietnamese-correction-v2` (mô hình Transformer Seq2Seq) để tự động hóa hoàn toàn việc sửa lỗi chính tả ngữ pháp thay vì thiết lập Regex sửa tay thủ công.
  - **Tối ưu hiệu năng:** Chạy xử lý batch-processing đa luồng trên GPU (chế độ `torch.bfloat16` và hàm nạp `generate`) cùng phương pháp greedy decoding giúp tăng tốc cực đại khi phải soi lỗi chính tả cho 35k bình luận dài.
- **Lớp 4 - Phân tách từ chuẩn học máy (Word Segmentation):** 
  - Khác với tiếng Anh (phân tách chuẩn khoảng trắng), tiếng Việt cần gom từ ghép. Hệ thống tích hợp thư viện **VnCoreNLP** (chạy nền Java) để cắt từ vựng tiếng Việt (ví dụ: `khách sạn` biến thành `khách_sạn`). Nhờ đó, PhoBERT có thể nắm bắt ý nghĩa của nguyên một cụm từ, tránh hiểu nhầm nghĩa.
- **Lớp 5 - Rà soát & Đóng gói:** Kiểm định độ dài câu hợp lệ cuối cùng, chuyển kiểu dữ liệu nhất quán và đóng gói thành cấu trúc object `Dataset` từ thư viện `datasets` để sẵn sàng luân chuyển thành luồng vào VRAM.

## 5. Lưu trữ và quản trị dữ liệu
- **Kiểm định:** Ra soát ngoại lệ và tính đồng nhất lần cuối sau khi làm sạch.
- **Định dạng tối ưu:** Đóng gói vào cấu trúc dữ liệu chuyên biệt của thư viện học sâu.
- **Luân chuyển:** Đẩy trực tiếp thành luồng vào bộ nhớ GPU để xử lý dữ liệu lớn mà không nghẽn hệ thống.

## 6. Tổng quan kiến trúc & Quá trình lựa chọn mô hình
Dự án sử dụng **PhoBERT** làm kiến trúc chính. Trong quá trình phát triển, nhóm đã thử nghiệm 3 hướng tiếp cận khác nhau để tìm ra phương án tối ưu nhất:

- **Hướng 1 - Baseline cơ bản (Đã loại bỏ):** Giữ nguyên bộ khía cạnh gốc (bao gồm khía cạnh chung chung như `FACILITIES`) và huấn luyện với đầy đủ các nhãn (Tích cực, Tiêu cực, Trung lập, Xung đột, Không đề cập). Phương án này gặp vấn đề vì số lượng nhãn quá phân mảnh, ranh giới giữa nhãn "Trung lập" và "Xung đột" rất mờ nhạt, làm giảm độ chính xác của mô hình.
- **Hướng 2 - Cải tiến (Đã loại bỏ):** Thay thế khía cạnh `FACILITIES` bằng `CLEANLINESS` (Vệ sinh) để bám sát hơn với đặc thù đánh giá khách sạn thực tế. Bắt đầu áp dụng hàm mất mát Focal Loss. Dù tính logic của khía cạnh tốt hơn, mô hình vẫn bị nhầm lẫn và đạt hiệu suất chưa cao do giữ lại các nhãn nhiễu không cần thiết.
- **Hướng 3 - Tối ưu 3-Class (Được chọn):** Rút gọn triệt để hệ thống nhãn xuống chỉ còn 3 lớp chính: **1 (Tích cực), 2 (Tiêu cực), và 0 (Không đề cập)**. Loại bỏ hoàn toàn các loại nhãn nhiễu như Trung lập và Xung đột. Sự kết hợp giữa bộ khía cạnh Hygiene sát thực tế, số lượng nhãn tối giản và hàm Focal Loss đã ép mô hình tập trung tối đa vào việc phân biệt rõ ràng cảm xúc, đặc biệt là nhận diện xuất sắc các mẫu dữ liệu thiểu số (Tiêu cực).

### Tối ưu hóa kỹ thuật
- **Hàm mất mát (Loss):** Sử dụng Focal Loss tùy chỉnh (thay vì Cross Entropy) để giải quyết tình trạng mất cân bằng nhãn đã phát hiện ở bước EDA.
- **Tối ưu phần cứng:** Kết hợp Gradient Accumulation đa bước và Mixed Precision để tối đa hóa kích thước batch trên GPU.
- **Giám sát:** Sử dụng Early Stopping dựa trên F1-score/Accuracy để thiết lập chốt chặn mốc hội tụ, chặn hiện tượng overfitting.
