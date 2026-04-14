import pandas as pd
import os
import glob
import torch
import re
from tqdm import tqdm
from vietnamese_processor import VietnameseTextPreprocessor

if torch.cuda.is_available():
    print(f"GPU detected: {torch.cuda.get_device_name(0)}")
else:
    print("Sử dụng CPU.")

print("Khởi tạo Preprocessor, anh pha ly cà phê rồi chờ xíu nha...")

extra_teencodes = { 
    'khách sạn': ['ks', 'ksan', 'ksạn', 'hotel'], 
    'nhà hàng': ['nhahang', 'nh'], 
    'nhân viên': ['nv', 'nvien', 'staff'],
    'phục vụ': ['pv', 'service'],
    'cửa hàng': ['store', 'sop', 'shopE', 'shop', 'shp'], 
    'phòng': ['phong', 'room', 'p'], 
    'tiền': ['xèng', 'xu', 'cành'],
    'đặt phòng': ['booking', 'book'],
    'nhận phòng': ['checkin'],
    'trả phòng': ['checkout'],
    'đánh giá': ['review', 'rv', 'rate', 'rating']
}

preprocessor = VietnameseTextPreprocessor(
    vncorenlp_dir='../VnCoreNLP', 
    extra_teencodes=extra_teencodes,
    max_correction_length=512
)

input_dir = '../data'
output_dir = '../data/cleaned'

csv_files = glob.glob(os.path.join(input_dir, '*.csv'))

def chunk_list(lst, chunk_size):
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]

def thuan_hoa_vs(text):
    if not isinstance(text, str): 
        return ""
    
    text = re.sub(r'\b(nhà|dọn|làm|giữ|mất|kém|phòng)\s+vs\b', r'\1 vệ sinh', text, flags=re.IGNORECASE)
    text = re.sub(r'\bvs\s+(sạch|dơ|kém|phòng|sẽ|an toàn)\b', r'vệ sinh \1', text, flags=re.IGNORECASE)
    
    text = re.sub(r'\bvs\b', 'với', text, flags=re.IGNORECASE)
    return text

for file_path in csv_files:
    file_name = os.path.basename(file_path)
    print(f"\nĐang dọn dẹp file: {file_name}")
    
    try:
        df = pd.read_csv(file_path)
        if 'Review' not in df.columns:
            continue
            
        raw_reviews = df['Review'].fillna('').tolist()
        
        print("Đang xử lý token 'vs' cứng đầu...")
        raw_reviews = [thuan_hoa_vs(r) for r in raw_reviews]
        
        processed_reviews = []
        batch_size = 32
        chunks = list(chunk_list(raw_reviews, batch_size))
        
        print(f"Bắt đầu preprocess {len(raw_reviews)} dòng review...")
        for chunk in tqdm(chunks, desc=f"Processing {file_name}", unit="batch"):
            processed_chunk = preprocessor.process_batch(chunk, correct_errors=True)
            processed_reviews.extend(processed_chunk)
            
        df['Review'] = processed_reviews
        
        out_path = os.path.join(output_dir, f"clean_{file_name}")
        df.to_csv(out_path, index=False)
        print(f"Đã lưu kết quả tinh khiết vào: {out_path}")
        
    except Exception as e:
        print(f"Lỗi khi xử lý file {file_name}: {e}")

preprocessor.close_vncorenlp()
print("\nHoàn tất xử lý dữ liệu NLP.")