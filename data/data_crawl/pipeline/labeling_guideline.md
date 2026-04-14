# LLM Labeling Guideline (Human-in-the-loop)

## 1. Mục tiêu

Tài liệu này hướng dẫn LLM gán nhãn sentiment theo từng aspect để giảm tải cho người label.
Người dùng sẽ review và sửa các mẫu nghi ngờ.

Dữ liệu thuộc domain đánh giá khách sạn.

## 2. Aspect và tập nhãn

Gán nhãn cho 6 aspect:

1. vệ sinh
2. đồ ăn thức uống
3. khách sạn
4. vị trí
5. phòng ốc
6. dịch vụ

Tập nhãn (3 lớp):

- `1` = positive: có khen rõ ràng cho aspect
- `2` = negative: có chê rõ ràng cho aspect
- `0` = none: không đề cập aspect hoặc thông tin mơ hồ

Quy tắc bắt buộc:

- Label theo từng aspect, không label theo cảm xúc chung của câu.
- Nếu không chắc chắn thì chọn `0`.
- Không suy đoán ngoài nội dung review.

## 3. Định nghĩa thực dụng cho từng aspect

1. vệ sinh:
- Từ khóa thường gặp: sạch, bẩn, mùi hôi, ẩm mốc, nhà vệ sinh, khăn, ga giường.

2. đồ ăn thức uống:
- Từ khóa: bữa sáng, buffet, món ăn, đồ uống, ngon, dở, ít món.

3. khách sạn:
- Đánh giá tổng thể cơ sở, không gian chung, decor, an ninh, trải nghiệm tổng quát.

4. vị trí:
- Gần/xa trung tâm, gần biển, dễ đi lại, khó tìm, giao thông.

5. phòng ốc:
- Diện tích phòng, giường, máy lạnh, cách âm, thiết bị trong phòng, nhà tắm trong phòng.

6. dịch vụ:
- Thái độ và chất lượng phục vụ của lễ tân, nhân viên, bảo vệ, xử lý yêu cầu.

## 4. Quy trình gán nhãn cho mỗi review

1. Đọc toàn bộ review.
2. Xác định các đoạn thông tin liên quan từng aspect.
3. Gán nhãn cho 6 aspect theo bảng 0/1/2.
4. Tự kiểm tra:
- Có aspect nào bị gán nhãn dựa trên suy đoán không?
- Có xung đột (vừa khen vừa chê) cho cùng aspect không?
5. Nếu xung đột trong cùng 1 aspect:
- Ưu tiên nhãn theo ý mạnh hơn, rõ hơn.
- Nếu cân bằng hoặc mơ hồ, chọn `0` và ghi chú.

## 5. Xử lý trường hợp khó

1. Câu rất ngắn, chung chung (ví dụ "tạm được", "ổn"):
- Thường gán `0` cho tất cả nếu không rõ aspect.

2. Câu có cả khen và chê trên nhiều aspect:
- Tách theo aspect, không tổng hợp chung.

3. Từ phủ định/đảo nghĩa (ví dụ "không sạch", "không ngon"):
- Gán `2` cho aspect liên quan nếu nội dung rõ ràng.

4. So sánh mơ hồ, không rõ đối tượng:
- Nếu không biết đang nói về aspect nào thì gán `0`.

## 6. Mẫu output chuẩn cho LLM

Mỗi review trả về đúng một object JSON:

```json
{
  "review_id": "...",
  "ve_sinh": 0,
  "do_an_thuc_uong": 0,
  "khach_san": 0,
  "vi_tri": 0,
  "phong_oc": 0,
  "dich_vu": 0,
  "label_note": "lý do ngắn gọn cho các nhãn không rõ ràng"
}
```

Ràng buộc output:

- Chỉ được dùng giá trị `0`, `1`, `2` cho 6 aspect.
- Không thêm văn bản ngoài JSON khi chạy batch labeling.

## 7. Prompt template để dùng với LLM

Sử dụng prompt sau cho từng review hoặc từng batch:

```text
Bạn là trợ lý gán nhãn sentiment theo aspect cho review khách sạn bằng tiếng Việt.

NHIỆM VỤ:
- Gán nhãn cho 6 aspect: ve_sinh, do_an_thuc_uong, khach_san, vi_tri, phong_oc, dich_vu.
- Nhãn: 1=positive, 2=negative, 0=none.

QUY TẮC:
- Label theo từng aspect, không theo cảm xúc chung.
- Nếu không chắc chắn thì gán 0.
- Không suy đoán ngoài nội dung.

OUTPUT:
- Trả về DUY NHẤT 1 JSON object với các trường:
  review_id, ve_sinh, do_an_thuc_uong, khach_san, vi_tri, phong_oc, dich_vu, label_note.

DỮ LIỆU:
review_id: {review_id}
review_text: {review_text}
```

## 8. Cơ chế human check tối giản

Để tối ưu công review, người kiểm tra ưu tiên các trường hợp:

1. Mẫu thuộc nhóm `hard`.
2. Mẫu có `label_note` khác rỗng.
3. Mẫu có xung đột sentiment giữa các aspect.
4. Mẫu review rất ngắn hoặc ngữ nghĩa mơ.

Mục tiêu là "LLM gán nhanh, người sửa điểm nhạy cảm", thay vì label tay 100% từ đầu.
