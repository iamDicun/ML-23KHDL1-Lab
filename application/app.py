from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import os
from pathlib import Path
import torch

# Thêm thư mục hf_space vào sys.path nếu cần import từ file nội bộ
sys.path.append(str(Path(__file__).parent))

# Import logic inference cho PhoBERT + GRU
from infer import _load_model, _predict_single, _predict_batch

app = FastAPI(
    title="PhoBERT + GRU ABSA Hotel API",
    description="API cho mô hình Aspect-Based Sentiment Analysis (PhoBERT+GRU) trên Hugging Face Spaces Docker",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
model = None
tokenizer = None
cfg = None
device = None

class PredictRequest(BaseModel):
    text: str

class PredictBatchRequest(BaseModel):
    texts: list[str]

@app.on_event("startup")
async def load_model_on_startup():
    global model, tokenizer, cfg, device
    
    # Chỉ định đường dẫn đến file model (.pt hoặc .pth)
    checkpoint_path = Path(__file__).parent / "model" / "best_phobert_gru_ce.pth" # Cập nhật lại đường dẫn thực tế
    
    if not checkpoint_path.exists():
        print(f"Lưu ý: Không tìm thấy checkpoint tại {checkpoint_path}")
        print("Vui lòng cập nhật đường dẫn checkpoint trong file app.py.")
        return
        
    try:
        model, tokenizer, cfg, device = _load_model(checkpoint_path)
        print("Đã tải mô hình thành công!")
    except Exception as e:
        print(f"Lỗi khi tải mô hình: {e}")

@app.get("/")
def read_root():
    return {"message": "Welcome to PhoBERT+GRU ABSA Hotel API"}

@app.post("/predict")
def predict(request: PredictRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Model is not loaded. Please check the checkpoint path.")
        
    try:
        result = _predict_single(model, tokenizer, cfg, device, request.text)
        return {"text": request.text, "predictions": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict_batch")
def predict_batch(request: PredictBatchRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Model is not loaded. Please check the checkpoint path.")
        
    try:
        results = _predict_batch(model, tokenizer, cfg, device, request.texts, batch_size=32)
        return {"predictions": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Hugging Face Spaces mặc định mở port 7860
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
