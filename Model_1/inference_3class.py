import pandas as pd
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from tqdm import tqdm
from sklearn.metrics import accuracy_score, f1_score

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
checkpoint_path = "model_weights\\checkpoint-5625"

print("Đang tải mô hình và tokenizer, anh chờ xíu nha...")
tokenizer = AutoTokenizer.from_pretrained("vinai/phobert-base-v2")
model = AutoModelForSequenceClassification.from_pretrained(checkpoint_path).to(device)
model.eval()

aspect_map = {
    "CLEANLINESS": "vệ sinh",
    "FOOD&DRINKS": "đồ ăn thức uống",
    "HOTEL": "khách sạn",
    "LOCATION": "vị trí",
    "ROOMS": "phòng ốc",
    "SERVICE": "dịch vụ"
}
aspects = list(aspect_map.values())
vi_to_en = {v: k for k, v in aspect_map.items()}

input_file = "data\\clean_reviews_filtered_long.csv"
output_file = "output\\output_results_3class.csv"

print(f"\nĐang mở file: {input_file}")
df = pd.read_csv(input_file)

df['Review'] = df['Review'].fillna("")

batch_size = 128 

print("Bắt đầu gán nhãn hàng loạt xé gió...")
for aspect in aspects:
    print(f"\nĐang xử lý khía cạnh: {aspect}")
    all_preds = []
    all_probs = []
    
    for i in tqdm(range(0, len(df), batch_size), desc=f"Inference {aspect}"):
        batch_texts = df['Review'].iloc[i:i+batch_size].tolist()
        
        inputs = tokenizer(
            batch_texts, 
            [aspect] * len(batch_texts), 
            return_tensors="pt", 
            padding=True, 
            truncation=True, 
            max_length=256
        ).to(device)
        
        with torch.no_grad():
            with torch.amp.autocast('cuda'): 
                outputs = model(**inputs)
            
            probs = F.softmax(outputs.logits, dim=-1)
            conf_scores = torch.max(probs, dim=-1)[0].cpu().numpy().round(4)
            predictions = torch.argmax(probs, dim=-1).cpu().numpy()
            
            all_preds.extend(predictions)
            all_probs.extend(conf_scores)
            
    df[f"{aspect}_label"] = all_preds
    df[f"{aspect}_prob"] = all_probs

df.to_csv(output_file, index=False)
print(f"Hoàn tất gán nhãn, kết quả lưu tại {output_file}.")

stats_output_file = "output\\aspect_stats.csv"
stats_rows = []

for aspect in aspects:
    label_col = f"{aspect}_label"
    label_counts = df[label_col].value_counts().sort_index()
    total = label_counts.sum()
    for label, count in label_counts.items():
        percent = round((count / total) * 100, 2) if total else 0.0
        stats_rows.append({
            "aspect": aspect,
            "label": label,
            "count": int(count),
            "percent": percent
        })

stats_df = pd.DataFrame(stats_rows)
stats_df.to_csv(stats_output_file, index=False)

print("\nThống kê phân bố nhãn theo khía cạnh:")
for aspect in aspects:
    subset = stats_df[stats_df["aspect"] == aspect]
    detail = ", ".join([f"nhãn {row['label']}: {row['percent']}% ({row['count']})" for _, row in subset.iterrows()])
    print(f"Khía cạnh {aspect}: {detail}")
print(f"Đã lưu thống kê tại {stats_output_file}.")

metrics_output_file = "output\\aspect_metrics.csv"
metrics_rows = []

for aspect in aspects:
    gt_col = vi_to_en.get(aspect)
    pred_col = f"{aspect}_label"
    if gt_col not in df.columns:
        continue
    y_true = df[gt_col].astype(int)
    y_pred = df[pred_col].astype(int)
    acc = accuracy_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred, average="macro")
    metrics_rows.append({
        "aspect": aspect,
        "accuracy": round(acc, 4),
        "f1_macro": round(f1, 4)
    })

metrics_df = pd.DataFrame(metrics_rows)
if not metrics_df.empty:
    metrics_df.to_csv(metrics_output_file, index=False)
    print("\nĐộ chính xác và F1 macro theo khía cạnh:")
    for _, row in metrics_df.iterrows():
        print(f"Khía cạnh {row['aspect']}: acc={row['accuracy']}, f1={row['f1_macro']}")
    print(f"Đã lưu metric tại {metrics_output_file}.")
else:
    print("\nKhông tìm thấy cột nhãn gốc để tính accuracy và F1.")