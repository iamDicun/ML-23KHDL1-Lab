import os
from transformers import AutoModel, AutoTokenizer

def download_phobert():
    model_name = "vinai/phobert-base-v2"
    save_directory = "./Model_2/phobert_local"
    
    print(f"Đang tải {model_name} từ Hugging Face...")
    
    # Tạo thư mục nếu chưa có
    if not os.path.exists(save_directory):
        os.makedirs(save_directory)
        
    # Tải Tokenizer và Model
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    
    # Lưu về máy tính
    tokenizer.save_pretrained(save_directory)
    model.save_pretrained(save_directory)
    
    print(f"Tải thành công! Mô hình đã được lưu tại: {save_directory}")

if __name__ == "__main__":
    download_phobert()