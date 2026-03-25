from __future__ import annotations

import json
import os
import time
from pathlib import Path
from urllib import error as urlerror
from urllib import request as urlrequest

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = SCRIPT_DIR.parent
STEP4_DIR = PIPELINE_DIR / "artifacts" / "step4"

INPUT_FILE = STEP4_DIR / "relabel_pool_3k_human_template_minimal.csv"
OUTPUT_FILE = STEP4_DIR / "relabel_pool_3k_human_independent_text.csv"
SUMMARY_FILE = STEP4_DIR / "relabel_pool_3k_human_independent_text_summary.json"
CHECKPOINT_FILE = STEP4_DIR / "relabel_pool_3k_human_independent_text_checkpoint.json"

# CHỈNH SỬA TẠI ĐÂY: Đặt tên biến môi trường (giữ nguyên để code bên dưới đọc được)
API_KEY_ENV = "LLM_API_KEY"
BASE_URL_ENV = "LLM_BASE_URL"
MODEL_ENV = "LLM_MODEL"

# ĐIỀN GIÁ TRỊ THỰC TẾ VÀO ĐÂY (Đây là giá trị mặc định nếu không tìm thấy biến môi trường)
DEFAULT_API_KEY = "[REDACTED_API_KEY]" # Key của bạn
DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai" 
DEFAULT_MODEL = "gemini-2.0-flash"

REQUEST_TIMEOUT_SEC = 60
MAX_RETRY = 3
SLEEP_BETWEEN_CALLS_SEC = 0.2
CHECKPOINT_EVERY = 25
FAILURE_NOTE = "LLM call failed; defaulted to 0"


OUTPUT_COLS = [
    "review_id",
    "Review",
    "relabel_group",
    "human_vệ sinh_label",
    "human_đồ ăn thức uống_label",
    "human_khách sạn_label",
    "human_vị trí_label",
    "human_phòng ốc_label",
    "human_dịch vụ_label",
    "annotator_id",
    "annotation_note",
]


SYSTEM_PROMPT = """Bạn là trợ lý gán nhãn sentiment theo aspect cho review khách sạn bằng tiếng Việt.

NHIỆM VỤ:
- Gán nhãn cho 6 aspect: ve_sinh, do_an_thuc_uong, khach_san, vi_tri, phong_oc, dich_vu.
- Nhãn: 1=positive, 2=negative, 0=none.

QUY TẮC:
- Label theo từng aspect, không theo cảm xúc chung của câu.
- Nếu không chắc chắn thì gán 0.
- Không suy đoán ngoài nội dung review.

OUTPUT:
- Trả về DUY NHẤT 1 JSON object, không có markdown/code-fence và không có văn bản bổ sung.
- JSON schema bắt buộc:
  {
    "ve_sinh": 0|1|2,
    "do_an_thuc_uong": 0|1|2,
    "khach_san": 0|1|2,
    "vi_tri": 0|1|2,
    "phong_oc": 0|1|2,
    "dich_vu": 0|1|2,
    "label_note": "ghi chú ngắn nếu có"
  }
"""


def _build_user_prompt(review_id: str, review_text: str) -> str:
    return f"review_id: {review_id}\nreview_text: {review_text}"


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()

    first = text.find("{")
    last = text.rfind("}")
    if first == -1 or last == -1 or last <= first:
        raise ValueError("Model response does not contain a valid JSON object")

    payload = text[first:last + 1]
    return json.loads(payload)


def _sanitize_label(v: object) -> int:
    try:
        iv = int(v)
    except (TypeError, ValueError):
        return 0
    if iv not in (0, 1, 2):
        return 0
    return iv


def _call_llm(api_key: str, base_url: str, model: str, review_id: str, review_text: str) -> dict:
    endpoint = base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(review_id, review_text)},
        ],
    }

    req = urlrequest.Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRY + 1):
        try:
            with urlrequest.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
                raw = resp.read().decode("utf-8")
                parsed = json.loads(raw)
                content = parsed["choices"][0]["message"]["content"]
                obj = _extract_json(content)
                return {
                    "human_vệ sinh_label": _sanitize_label(obj.get("ve_sinh")),
                    "human_đồ ăn thức uống_label": _sanitize_label(obj.get("do_an_thuc_uong")),
                    "human_khách sạn_label": _sanitize_label(obj.get("khach_san")),
                    "human_vị trí_label": _sanitize_label(obj.get("vi_tri")),
                    "human_phòng ốc_label": _sanitize_label(obj.get("phong_oc")),
                    "human_dịch vụ_label": _sanitize_label(obj.get("dich_vu")),
                    "annotation_note": str(obj.get("label_note", "")).strip(),
                }
        except urlerror.HTTPError as exc:
            last_error = exc
            try:
                body = exc.read().decode("utf-8", errors="replace")
                last_error = RuntimeError(f"HTTP {exc.code}: {body[:600]}")
            except Exception:
                last_error = RuntimeError(f"HTTP {exc.code}: {exc.reason}")
            if attempt < MAX_RETRY:
                time.sleep(1.0 * attempt)
            else:
                break
        except (urlerror.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < MAX_RETRY:
                time.sleep(1.0 * attempt)
            else:
                break

    raise RuntimeError(f"LLM call failed for review_id={review_id}: {last_error}")


def _default_labels(note: str) -> dict:
    return {
        "human_vệ sinh_label": 0,
        "human_đồ ăn thức uống_label": 0,
        "human_khách sạn_label": 0,
        "human_vị trí_label": 0,
        "human_phòng ốc_label": 0,
        "human_dịch vụ_label": 0,
        "annotation_note": note,
    }


def _build_result_row(row: pd.Series, labels: dict) -> dict:
    relabel_group = str(row.get("relabel_group", ""))
    annotation_note = str(labels.get("annotation_note", "")).strip()
    if relabel_group.lower() == "hard" and not annotation_note:
        annotation_note = "Can review ky nhom hard"

    return {
        "review_id": row.get("review_id", ""),
        "Review": str(row.get("Review", "")),
        "relabel_group": relabel_group,
        "human_vệ sinh_label": int(labels.get("human_vệ sinh_label", 0)),
        "human_đồ ăn thức uống_label": int(labels.get("human_đồ ăn thức uống_label", 0)),
        "human_khách sạn_label": int(labels.get("human_khách sạn_label", 0)),
        "human_vị trí_label": int(labels.get("human_vị trí_label", 0)),
        "human_phòng ốc_label": int(labels.get("human_phòng ốc_label", 0)),
        "human_dịch vụ_label": int(labels.get("human_dịch vụ_label", 0)),
        "annotator_id": str(row.get("annotator_id", "") or ""),
        "annotation_note": annotation_note,
    }


def _write_progress(records: list[dict], total: int, failures: list[dict], done: bool) -> None:
    progress_df = pd.DataFrame(records, columns=OUTPUT_COLS)
    progress_df.to_csv(OUTPUT_FILE, index=False)

    summary = {
        "input": str(INPUT_FILE),
        "output": str(OUTPUT_FILE),
        "rows": int(len(progress_df)),
        "total_rows": int(total),
        "done": done,
        "method": "LLM API contextual labeling",
        "failures": failures,
        "failure_count": len(failures),
    }
    with CHECKPOINT_FILE.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)


def _load_existing_progress(df: pd.DataFrame) -> list[dict]:
    if not OUTPUT_FILE.exists():
        return []

    try:
        existing = pd.read_csv(OUTPUT_FILE)
    except Exception:
        return []

    if existing.empty:
        return []

    missing_cols = [c for c in OUTPUT_COLS if c not in existing.columns]
    if missing_cols:
        return []

    existing = existing[OUTPUT_COLS].copy()

    # Retry from the first previously failed row so resume can recover bad runs.
    fail_mask = (
        existing["annotation_note"]
        .fillna("")
        .astype(str)
        .str.strip()
        .eq(FAILURE_NOTE)
    )
    if fail_mask.any():
        first_fail_idx = int(fail_mask.idxmax())
        existing = existing.iloc[:first_fail_idx].copy()
    existing_count = min(len(existing), len(df))
    existing = existing.iloc[:existing_count].copy()

    if "review_id" in df.columns:
        src_ids = df["review_id"].astype(str).head(existing_count).tolist()
        out_ids = existing["review_id"].astype(str).tolist()
        if src_ids != out_ids:
            return []

    return existing.to_dict(orient="records")


def main() -> None:
    api_key = os.getenv(API_KEY_ENV, DEFAULT_API_KEY).strip()
    base_url = os.getenv(BASE_URL_ENV, DEFAULT_BASE_URL).strip()
    model = os.getenv(MODEL_ENV, DEFAULT_MODEL).strip()

    if not api_key:
        raise RuntimeError(
            f"Missing API key. Please set environment variable {API_KEY_ENV}."
        )

    df = pd.read_csv(INPUT_FILE)
    df = df.copy()
    df["Review"] = df["Review"].fillna("").astype(str)

    records = _load_existing_progress(df)
    start_idx = len(records)

    failures = []
    total = len(df)

    if CHECKPOINT_FILE.exists():
        try:
            checkpoint = json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
            raw_failures = checkpoint.get("failures", [])
            if isinstance(raw_failures, list):
                failures = raw_failures
        except Exception:
            failures = []

    if start_idx >= total:
        print(f"Nothing to do. Found existing output with {start_idx}/{total} rows.")
    else:
        print(f"Resuming from {start_idx}/{total}")

    try:
        for idx in range(start_idx, total):
            row = df.iloc[idx]
            review_id = str(row.get("review_id", ""))
            review_text = str(row.get("Review", ""))
            try:
                lab = _call_llm(api_key, base_url, model, review_id, review_text)
            except Exception as exc:  # noqa: BLE001
                failures.append({"review_id": review_id, "error": str(exc)})
                lab = _default_labels(FAILURE_NOTE)

            records.append(_build_result_row(row, lab))

            processed = idx + 1
            if processed % CHECKPOINT_EVERY == 0 or processed == total:
                _write_progress(records, total, failures, done=False)
                print(f"Processed {processed}/{total} (checkpoint saved)")

            time.sleep(SLEEP_BETWEEN_CALLS_SEC)
    except KeyboardInterrupt:
        _write_progress(records, total, failures, done=False)
        print("Interrupted by user. Progress has been checkpointed.")
        return

    _write_progress(records, total, failures, done=True)

    final_summary = {
        "input": str(INPUT_FILE),
        "output": str(OUTPUT_FILE),
        "rows": int(len(records)),
        "total_rows": int(total),
        "done": len(records) == total,
        "method": "LLM API contextual labeling",
        "model": model,
        "base_url": base_url,
        "failures": failures,
        "failure_count": len(failures),
    }
    with SUMMARY_FILE.open("w", encoding="utf-8") as f:
        json.dump(final_summary, f, ensure_ascii=False, indent=2)

    with CHECKPOINT_FILE.open("w", encoding="utf-8") as f:
        json.dump(final_summary, f, ensure_ascii=False, indent=2)

    print("Independent text relabel completed")
    print(json.dumps(final_summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
