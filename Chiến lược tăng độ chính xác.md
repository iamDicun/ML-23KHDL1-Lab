# 📘 Model 1 Optimization Strategies (PhoBERT - ABSA)

---

# 🎯 Mục tiêu

Tối ưu **Model 1 (Teacher)** để:

- Đạt F1 tốt (~78–82%)
    
- Tạo pseudo-label **đủ sạch** cho Model 2
    
- KHÔNG overfit quá mức (để Model 2 còn học được thêm)
    

---

# ⚠️ Nguyên tắc quan trọng

Model 1 KHÔNG cần quá phức tạp:

- ❌ Không tối ưu quá mức → dễ overfit
    
- ❌ Không dùng trick quá mạnh → Model 2 không cải thiện được
    

👉 Mục tiêu: **Strong but not perfect teacher**

---

# 🚀 CHIẾN LƯỢC 1 — Fine-tuning chuẩn cho PhoBERT

## Cấu hình đề xuất

- Learning rate: `2e-5 → 3e-5`
    
- Epoch: `4–5`
    
- Batch size: `16–32`
    
- Warmup: `10%`
    

---

## Layer-wise Learning Rate Decay (LLRD)

- Layer dưới: LR nhỏ
    
- Layer trên: LR lớn
    

👉 Giúp:

- Giữ knowledge pretrained
    
- Học task-specific tốt hơn
    

---

# 🚀 CHIẾN LƯỢC 2 — Pooling thay CLS

## Vấn đề

CLS token đôi khi không capture đủ thông tin

---

## Giải pháp

### Mean Pooling

```python
embedding = hidden_states.mean(dim=1)
```

👉 Thường tăng F1 ~1–2%

---

# 🚀 CHIẾN LƯỢC 3 — Focal Loss + Class Weight

## Khi nào dùng

- Data imbalance
    
- Class 0 chiếm đa số
    

---

## Áp dụng

```python
loss = focal_loss(logits, labels)
```

---

## Nâng cấp

- Dùng alpha riêng cho từng class
    
- Có thể khác nhau theo từng aspect
    

---

# 🚀 CHIẾN LƯỢC 4 — Threshold Tuning

## Vấn đề

- Argmax không tối ưu cho F1
    

---

## Giải pháp

- Tune threshold trên validation set
    
- Grid search threshold
    

👉 Có thể tăng F1 đáng kể mà không đổi model

---

# 🚀 CHIẾN LƯỢC 5 — Data Cleaning

## Thực hiện

- Xóa duplicate
    
- Chuẩn hóa text
    
- Loại bỏ ký tự nhiễu
    

👉 Cải thiện ổn định

---

# 🚀 CHIẾN LƯỢC 6 — Regularization nhẹ

## Áp dụng

```python
Dropout = 0.3
```

👉 Tránh overfit

---

# 🚀 CHIẾN LƯỢC 7 — Early Stopping theo F1

## Lưu ý

- Không dừng theo loss
    
- Dừng theo F1 validation
    

---

# ⚠️ NHỮNG GÌ KHÔNG NÊN LÀM Ở MODEL 1

## ❌ Kiến trúc quá phức tạp

- Không cần attention phức tạp
    
- Không cần multi-layer head sâu
    

---

## ❌ Modeling label correlation mạnh

- Không cần ràng buộc giữa các aspect
    

👉 Để Model 2 học phần này

---

## ❌ Over-tune hyperparameters

- Không cần exhaustive search
    

---

# 🎯 Mục tiêu cuối

Model 1 nên đạt:

- F1: ~78–82%
    
- Generalize tốt
    
- Không quá bias
    

---

# 🔥 Chuẩn bị cho Model 2

Model 1 nên:

- Tạo pseudo-label đủ sạch
    
- Không quá confident sai
    

---

# 📌 Tóm tắt

```
1. Fine-tune PhoBERT chuẩn
2. Mean pooling
3. Focal Loss + class weight
4. Threshold tuning
5. Regularization nhẹ
6. Early stopping theo F1
```

👉 Mục tiêu: **Teacher tốt nhưng chưa hoàn hảo**