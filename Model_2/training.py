import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModel
from torch.optim import AdamW
from tqdm import tqdm

# ==========================================
# 1. CẤU HÌNH THÔNG SỐ (HYPERPARAMETERS)
# ==========================================
MODEL_PATH = "./Model_2/phobert_local" # Đường dẫn model đã tải ở file download_model.py
TRAIN_FILE = "Model_2/data/crawl_only_train.csv"
VAL_FILE = "Model_2/data/crawl_only_val.csv"
TEST_FILE = "Model_2/data/crawl_only_test.csv"

MAX_LEN = 128
BATCH_SIZE = 16
EPOCHS = 5
LEARNING_RATE = 2e-5
GRU_HIDDEN_DIM = 256

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
LABEL_COLS = ['vệ sinh_label', 'đồ ăn thức uống_label', 'khách sạn_label', 'vị trí_label', 'phòng ốc_label', 'dịch vụ_label']
NUM_LABELS = len(LABEL_COLS)

# ==========================================
# 2. CHUẨN BỊ DỮ LIỆU (DATASET)
# ==========================================
class HotelReviewDataset(Dataset):
    def __init__(self, csv_file, tokenizer, max_len):
        self.data = pd.read_csv(csv_file).dropna(subset=['Review'])
        self.tokenizer = tokenizer
        self.max_len = max_len
        
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        row = self.data.iloc[idx]
        review_text = str(row['Review'])
        
        # Lấy giá trị của 6 nhãn (chuyển thành float cho MSELoss)
        labels = torch.tensor(row[LABEL_COLS].values.astype(float), dtype=torch.float)
        
        # Tokenizer của PhoBERT
        encoding = self.tokenizer(
            review_text,
            add_special_tokens=True,
            max_length=self.max_len,
            padding='max_length',
            truncation=True,
            return_attention_mask=True,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': labels
        }

# ==========================================
# 3. KIẾN TRÚC MÔ HÌNH: PhoBERT + BiGRU
# ==========================================
class PhoBERT_GRU_Model(nn.Module):
    def __init__(self, phobert_path, gru_hidden_dim, num_labels):
        super(PhoBERT_GRU_Model, self).__init__()
        
        # Lớp 1: PhoBERT để trích xuất đặc trưng
        self.phobert = AutoModel.from_pretrained(phobert_path)
        phobert_hidden_size = self.phobert.config.hidden_size # Thường là 768
        
        # Lớp 2: BiGRU học theo chuỗi (Hai chiều)
        self.gru = nn.GRU(
            input_size=phobert_hidden_size, 
            hidden_size=gru_hidden_dim, 
            num_layers=1, 
            batch_first=True, 
            bidirectional=True
        )
        
        # Lớp 3: Lớp phân loại cuối cùng (Dự đoán số thực)
        # BiGRU nhân đôi đầu ra do chạy 2 chiều
        self.classifier = nn.Linear(gru_hidden_dim * 2, num_labels)
        
    def forward(self, input_ids, attention_mask):
        # Trích xuất vector từ PhoBERT
        phobert_outputs = self.phobert(input_ids=input_ids, attention_mask=attention_mask)
        sequence_output = phobert_outputs.last_hidden_state # Shape: [batch, max_len, 768]
        
        # Đưa chuỗi vector qua BiGRU
        gru_output, _ = self.gru(sequence_output) # Shape: [batch, max_len, gru_hidden*2]
        
        # Gộp các đặc trưng bằng cách lấy trung bình trên toàn chuỗi (Mean Pooling)
        pooled_output = torch.mean(gru_output, dim=1) 
        
        # Đưa qua lớp Linear để lấy điểm số dự đoán
        logits = self.classifier(pooled_output)
        return logits

# ==========================================
# 4. HÀM HUẤN LUYỆN VÀ ĐÁNH GIÁ
# ==========================================
def train_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    
    for batch in tqdm(dataloader, desc="Training"):
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        labels = batch['labels'].to(device)
        
        optimizer.zero_grad()
        outputs = model(input_ids, attention_mask)
        
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        
    return total_loss / len(dataloader)

def eval_model(model, dataloader, criterion, device, mode="Validation"):
    model.eval()
    total_loss = 0
    
    with torch.no_grad():
        for batch in tqdm(dataloader, desc=f"Evaluating ({mode})"):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)
            
            outputs = model(input_ids, attention_mask)
            loss = criterion(outputs, labels)
            total_loss += loss.item()
            
    return total_loss / len(dataloader)

# ==========================================
# 5. CHƯƠNG TRÌNH CHÍNH
# ==========================================
def main():
    print("1. Đang tải Tokenizer và cấu hình Dữ liệu...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    
    train_dataset = HotelReviewDataset(TRAIN_FILE, tokenizer, MAX_LEN)
    val_dataset = HotelReviewDataset(VAL_FILE, tokenizer, MAX_LEN)
    test_dataset = HotelReviewDataset(TEST_FILE, tokenizer, MAX_LEN)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    print("2. Khởi tạo mô hình PhoBERT + BiGRU...")
    model = PhoBERT_GRU_Model(MODEL_PATH, GRU_HIDDEN_DIM, NUM_LABELS).to(DEVICE)
    
    # Sử dụng MSELoss vì nhãn là các số đánh giá 0, 1, 2
    criterion = nn.MSELoss() 
    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE)
    
    print(f"Bắt đầu huấn luyện trên thiết bị: {DEVICE}")
    best_val_loss = float('inf')
    
    for epoch in range(EPOCHS):
        print(f"\n--- Epoch {epoch+1}/{EPOCHS} ---")
        
        train_loss = train_epoch(model, train_loader, criterion, optimizer, DEVICE)
        print(f"Train Loss: {train_loss:.4f}")
        
        val_loss = eval_model(model, val_loader, criterion, DEVICE, mode="Validation")
        print(f"Val Loss: {val_loss:.4f}")
        
        # Lưu mô hình tốt nhất
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), "Model_2/phobert_local/best_phobert_gru.pth")
            print(">> Đã lưu mô hình tốt nhất ở Epoch này!")

    print("\n3. Đánh giá lần cuối trên tập Test...")
    model.load_state_dict(torch.load("Model_2/phobert_local/best_phobert_gru.pth"))
    test_loss = eval_model(model, test_loader, criterion, DEVICE, mode="Test")
    print(f"--> Test Loss cuối cùng: {test_loss:.4f}")
    print("HOÀN THÀNH!")

if __name__ == "__main__":
    main()