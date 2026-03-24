import pandas as pd
import numpy as np
import os
import glob

output_dir = 'data/processed_datasets_3class'
os.makedirs(output_dir, exist_ok=True)

csv_files = glob.glob('data/vlsp/*.csv')

main_attrs = ['CLEANLINESS', 'FOOD&DRINKS', 'HOTEL', 'LOCATION', 'ROOMS', 'SERVICE']

def get_majority_label_strict_neg(vals):
    # Loại bỏ các giá trị 0
    vals = [v for v in vals if v != 0]
    
    if not vals:
        return 0
        
    # Đếm số lượng nhãn positive và negative
    pos_count = vals.count(1)
    neg_count = vals.count(2)
    
    # Xử lý trường hợp không có nhãn 1 hoặc 2
    if pos_count == 0 and neg_count == 0:
        return 0
        
    # Áp dụng quy tắc gán nhãn
    if pos_count > neg_count:
        return 1
    else:
        return 2

report_lines = []
report_lines.append("BÁO CÁO TỔNG HỢP: CHUẨN HÓA DỮ LIỆU 3 CLASS\n")
report_lines.append("=" * 50)

for file in csv_files:
    try:
        df = pd.read_csv(file)
        
        if 'Review' not in df.columns:
            continue
            
        report_lines.append(f"\n=> KẾT QUẢ XỬ LÝ TẬP DỮ LIỆU: {file}")
        
        new_df = pd.DataFrame()
        new_df['Review'] = df['Review']

        all_cols = df.columns.tolist()

        for attr in main_attrs:
            if attr == 'CLEANLINESS':
                cols = [c for c in all_cols if 'CLEANLINESS' in c]
            elif attr == 'ROOMS':
                cols = [c for c in all_cols if (c.startswith('ROOMS#') or c.startswith('ROOM_AMENITIES#')) and 'CLEANLINESS' not in c]
            elif attr == 'HOTEL':
                cols = [c for c in all_cols if (c.startswith('HOTEL#') or c.startswith('FACILITIES#')) and 'CLEANLINESS' not in c]
            else:
                cols = [c for c in all_cols if c.startswith(attr + '#')]
            
            if cols:
                new_df[attr] = df[cols].apply(lambda row: get_majority_label_strict_neg(row.values), axis=1)
            else:
                new_df[attr] = 0

        out_path = os.path.join(output_dir, f"processed_{file}")
        new_df.to_csv(out_path, index=False)

        after_counts = new_df.drop(columns=['Review'], errors='ignore').apply(pd.Series.value_counts).sum(axis=1).to_dict()
        report_lines.append(f"Phân phối nhãn sau khi xử lý:\n{after_counts}")
        report_lines.append("-" * 50)

    except Exception as e:
        report_lines.append(f"Lỗi khi xử lý file {file}: {e}")

report_text = "\n".join(report_lines)
report_path = os.path.join(output_dir, 'summary_report.txt')
with open(report_path, 'w', encoding='utf-8') as f:
    f.write(report_text)

print(f"Quá trình xử lý hoàn tất. Dữ liệu đầu ra được lưu tại thư mục: {output_dir}")