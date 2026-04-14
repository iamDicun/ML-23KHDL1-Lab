import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer
from sklearn.metrics import f1_score, accuracy_score
from transformers import EarlyStoppingCallback

print("Khởi động huấn luyện PhoBERT (bản hygiene).")

# 1. Data strategy: map aspect names to descriptive Vietnamese phrases
aspect_map = {
    'CLEANLINESS': 'khách hàng đánh giá về mức độ vệ sinh sạch sẽ',
    'FOOD&DRINKS': 'khách hàng đánh giá về chất lượng đồ ăn thức uống',
    'HOTEL': 'khách hàng đánh giá tổng quan về khách sạn',
    'LOCATION': 'khách hàng đánh giá về vị trí địa lý',
    'ROOMS': 'khách hàng đánh giá về tiện nghi phòng ốc',
    'SERVICE': 'khách hàng đánh giá về thái độ phục vụ của dịch vụ'
}


def prepare_sequence_pair_data(csv_path):
    df = pd.read_csv(csv_path)
    records = []
    for _, row in df.iterrows():
        review = str(row['Review'])
        for aspect_col, aspect_vi in aspect_map.items():
            label = int(row[aspect_col])
            # Package each sample as review text paired with the aspect description
            records.append({'text': review, 'aspect': aspect_vi, 'label': label})
    return pd.DataFrame(records)


# Load processed hygiene datasets
train_df = prepare_sequence_pair_data('data\\final_datasets_hygiene_3class\\final_processed_1-VLSP2018-SA-Hotel-train.csv')
dev_df = prepare_sequence_pair_data('data\\final_datasets_hygiene_3class\\final_processed_2-VLSP2018-SA-Hotel-dev.csv')
test_df = prepare_sequence_pair_data('data\\final_datasets_hygiene_3class\\final_processed_3-VLSP2018-SA-Hotel-test.csv')

train_dataset = Dataset.from_pandas(train_df)
dev_dataset = Dataset.from_pandas(dev_df)
test_dataset = Dataset.from_pandas(test_df)

# 2. Tokenization
model_name = "vinai/phobert-base-v2"
tokenizer = AutoTokenizer.from_pretrained(model_name)


def tokenize_function(examples):
    # PhoBERT automatically inserts [SEP] between text and aspect
    return tokenizer(
        examples['text'],
        examples['aspect'],
        padding='max_length',
        truncation=True,
        max_length=256
    )


print("Thực hiện tokenization dữ liệu.")
train_dataset = train_dataset.map(tokenize_function, batched=True)
dev_dataset = dev_dataset.map(tokenize_function, batched=True)
test_dataset = test_dataset.map(tokenize_function, batched=True)


# 3. Custom focal loss to address class imbalance
class FocalLossTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits

        ce_loss = F.cross_entropy(logits, labels, reduction='none')
        pt = torch.exp(-ce_loss)

        focal_loss = 1.0 * (1 - pt) ** 2.0 * ce_loss

        loss = focal_loss.mean()
        return (loss, outputs) if return_outputs else loss


# Metric computation helpers

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = logits.argmax(axis=-1)
    f1 = f1_score(labels, preds, average='macro')
    acc = accuracy_score(labels, preds)
    return {"accuracy": acc, "f1_macro": f1}


# Initialize model with five labels (0–4)
model = AutoModelForSequenceClassification.from_pretrained(
    model_name,
    num_labels=5,
    use_safetensors=True  # Ensure safetensors is used when loading weights
)

# 4. Training configuration tailored for 8GB VRAM
training_args = TrainingArguments(
    output_dir="./phobert_absa_results_v2.1_hygiene",  # Use distinct directory to avoid overwriting previous runs
    num_train_epochs=15,
    per_device_train_batch_size=8,
    gradient_accumulation_steps=2,
    per_device_eval_batch_size=16,
    fp16=True,
    learning_rate=2e-5,
    weight_decay=0.05,
    warmup_ratio=0.1,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1_macro",
    logging_steps=50,
    report_to="none"
)

trainer = FocalLossTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=dev_dataset,
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
)

print("Bắt đầu quá trình huấn luyện.")
trainer.train()

# Evaluate trên tập Test cuối cùng
print("Đánh giá trên tập test:")
test_results = trainer.evaluate(test_dataset)
print(test_results)
