# 📘 PhoBERT Multi-Task Learning với Pseudo-Labeling

---

# 1. Tổng quan bài toán

- Input: Review (text tiếng Việt)
    
- Output: 6 aspect
    
    - FACILITIES
        
    - FOOD&DRINKS
        
    - HOTEL
        
    - LOCATION
        
    - ROOMS
        
    - SERVICE
        
- Mỗi aspect có 5 class: {0,1,2,3,4}
    

👉 Đây là **Multi-task classification (6 tasks, mỗi task 5 class)**

---

# 🚀 PIPELINE TỔNG THỂ

```
Train Model 1 → Pseudo-label → Lọc → Fix tay → Train Model 2 → Evaluate
```

---

# 🧠 PHASE 1 — MODEL 1 (TEACHER)

## 1.1 Mục tiêu

- Học từ data chuẩn (VLSP)
    
- Tạo model để gán nhãn cho data mới
    

---

## 1.2 Kiến trúc

```
PhoBERT → CLS → 6 heads → softmax
```

### Code mẫu

```python
class PhoBERTMultiTask(nn.Module):
    def __init__(self):
        super().__init__()
        self.phobert = AutoModel.from_pretrained("vinai/phobert-base")
        self.heads = nn.ModuleList([
            nn.Linear(768, 3) for _ in range(6)
        ])

    def forward(self, input_ids, attention_mask):
        outputs = self.phobert(input_ids=input_ids,
                               attention_mask=attention_mask)
        cls = outputs.last_hidden_state[:, 0, :]
        logits = [head(cls) for head in self.heads]
        return logits
```

---

## 1.3 Loss function

```python
loss = sum(CrossEntropyLoss(logits[i], labels[:, i]) for i in range(6))
```

---

## 1.4 Training

- Optimizer: AdamW
    
- LR: 2e-5
    
- Epoch: 3–5
    
- Batch size: 16–32
    

---

## 1.5 Evaluation

- Accuracy / F1 theo từng aspect
    

⚠️ Nếu F1 < 75% → không nên pseudo-label

---

## Output Model 1

- Model teacher đã train xong
    

---

# 🧠 PHASE 2 — PSEUDO LABELING

## 2.1 Predict data crawl (30k)

```python
probs = softmax(logits)
```

---

## 2.2 Confidence filtering

Chỉ giữ sample nếu:

```python
max(prob) > 0.9
```

Hoặc chặt hơn:

```python
all heads > 0.8
```

---

## Output

- Dataset pseudo-label sạch hơn (~15k–25k)
    

---

# 🧠 PHASE 3 — FIX TAY (HUMAN-IN-THE-LOOP)

## 3.1 Chọn subset

- 2k–3k samples
    

## 3.2 Sửa label

👉 Giúp giảm noise mạnh

---

# 🧠 PHASE 4 — MODEL 2 (STUDENT)

## 4.1 Mục tiêu

- Model chính để deploy
    
- Học từ data thật + pseudo
    

---

## 4.2 Base model

👉 **KHÔNG dùng lại Model 1**

```text
PhoBERT pretrained (vinai/phobert-base)
```

---

## 4.3 Kiến trúc

Giống Model 1 nhưng có thể cải tiến:

```python
self.fc = nn.Sequential(
    nn.Linear(768, 256),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(256, 3)
)
```

---

## 4.4 Data training

```
Train set =
    data thật (VLSP)
  + pseudo data
  + pseudo đã fix tay
```

---

## 4.5 Loss function (QUAN TRỌNG)

```python
loss = loss_real + λ * loss_pseudo
```

### Code chi tiết

```python
loss_real = sum(loss_fn(logits_real[i], labels_real[:, i]) for i in range(6))
loss_pseudo = sum(loss_fn(logits_pseudo[i], labels_pseudo[:, i]) for i in range(6))

loss = loss_real + 0.3 * loss_pseudo
```

---

## 4.6 Training strategy

### Stage 1: Warm-up

- Train chỉ trên data thật
    

### Stage 2: Full training

- Train trên data thật + pseudo
    

---

## 4.7 DataLoader

### Cách 1 (đơn giản)

- Gộp dataset
    
- Đánh dấu pseudo sample
    

### Cách 2 (chuẩn hơn)

```python
for real_batch, pseudo_batch in zip(loader_real, loader_pseudo):
    train step
```

---

## 4.8 Improve

- Confidence weighting
    
- Oversample data thật
    
- Early stopping theo validation set (data thật)
    

---

# 🧠 PHASE 5 — EVALUATION

## So sánh

|Model|Data|F1|
|---|---|---|
|Model 1|VLSP|~78%|
|Model 2|+ pseudo|~82%|

---

# ⚠️ LỖI CẦN TRÁNH

- Không lọc confidence
    
- Dùng toàn bộ pseudo data
    
- Không giữ data thật
    
- Train Model 2 giống Model 1
    
- Không evaluate Model 1
    

---

# 🎯 KẾT LUẬN

- Model 1 = Teacher (gán nhãn)
    
- Model 2 = Student (model chính)
    

👉 Đây là:

```
Self-training / Semi-supervised learning
```

---

# 🔥 PIPELINE FINAL

```
1. Train Model 1
2. Predict 30k data
3. Lọc confidence
4. Fix tay 2k–3k
5. Train Model 2 (weighted loss)
6. Evaluate
```