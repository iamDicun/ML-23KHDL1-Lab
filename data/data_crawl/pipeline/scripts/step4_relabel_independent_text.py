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
DEFAULT_API_KEY = "" # Key của bạn
DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai" 
DEFAULT_MODEL = "models/gemini-2.5-flash-lite"

REQUEST_TIMEOUT_SEC = 60
MAX_RETRY = 3
CHECKPOINT_EVERY = 25
BATCH_SIZE = 25
DEFAULT_REQUESTS_PER_MINUTE = 10
REQUESTS_PER_MINUTE_ENV = "REQUESTS_PER_MINUTE"
RESUME_FROM_EXISTING_ENV = "RESUME_FROM_EXISTING"

try:
    REQUESTS_PER_MINUTE = max(
        1,
        int(os.getenv(REQUESTS_PER_MINUTE_ENV, str(DEFAULT_REQUESTS_PER_MINUTE)).strip()),
    )
except ValueError:
    REQUESTS_PER_MINUTE = DEFAULT_REQUESTS_PER_MINUTE

RESUME_FROM_EXISTING = (
    os.getenv(RESUME_FROM_EXISTING_ENV, "1").strip().lower() not in {"0", "false", "no"}
)

MIN_INTERVAL_BETWEEN_REQUESTS_SEC = 60.0 / REQUESTS_PER_MINUTE
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
]


SYSTEM_PROMPT = """Bạn là trợ lý gán nhãn sentiment theo aspect cho review khách sạn bằng tiếng Việt.

NHIỆM VỤ:
- Gán nhãn cho 6 aspect: ve_sinh, do_an_thuc_uong, khach_san, vi_tri, phong_oc, dich_vu.
- Nhãn: 1=positive, 2=negative, 0=none.
- Một lần nhận N review và phải trả về kết quả cho TẤT CẢ review.

QUY TẮC:
- Label theo từng aspect, không theo cảm xúc chung của câu.
- Nếu không chắc chắn thì gán 0.
- Không suy đoán ngoài nội dung review.

OUTPUT:
- Trả về DUY NHẤT 1 JSON object, không có markdown/code-fence và không có văn bản bổ sung.
- JSON schema bắt buộc:
  {
    "results": [
      {
        "review_id": "string",
        "ve_sinh": 0|1|2,
        "do_an_thuc_uong": 0|1|2,
        "khach_san": 0|1|2,
        "vi_tri": 0|1|2,
        "phong_oc": 0|1|2,
        "dich_vu": 0|1|2
      }
    ]
  }
"""


FEW_SHOT_BATCH_MESSAGES = [
    {
        "role": "user",
        "content": json.dumps(
            {
                "reviews": [
                    {
                        "review_id": "225321774",
                        "review_text": "cô kate trường là nhân_viên giỏi nhất mà tôi từng làm_việc cùng trong nhiều chuyến đi tôi khuyên mọi người nên liên_hệ với cô ấy nếu cần hỗ_trợ nhìn_chung tất_cả mọi người đều rất chuyên_nghiệp",
                    },
                    {
                        "review_id": "212416972",
                        "review_text": "vị_trí thuận_lợi để khám_phá các bảo_tàng gần đó",
                    },
                ]
            },
            ensure_ascii=False,
        ),
    },
    {
        "role": "assistant",
        "content": json.dumps(
            {
                "results": [
                    {
                        "review_id": "225321774",
                        "ve_sinh": 0,
                        "do_an_thuc_uong": 0,
                        "khach_san": 0,
                        "vi_tri": 0,
                        "phong_oc": 0,
                        "dich_vu": 1,
                    },
                    {
                        "review_id": "212416972",
                        "ve_sinh": 0,
                        "do_an_thuc_uong": 0,
                        "khach_san": 0,
                        "vi_tri": 1,
                        "phong_oc": 0,
                        "dich_vu": 0,
                    },
                ]
            },
            ensure_ascii=False,
        ),
    },
]


def _build_batch_user_prompt(batch_items: list[dict]) -> str:
    payload = {
        "reviews": [
            {
                "review_id": str(item["review_id"]),
                "review_text": str(item["review_text"]),
            }
            for item in batch_items
        ]
    }
    return json.dumps(payload, ensure_ascii=False)


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


def _call_llm_batch(api_key: str, base_url: str, model: str, batch_items: list[dict]) -> dict[str, dict]:
    endpoint = base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model,
        "temperature": 0,
        "response_format": { "type": "json_object" }, # Ép trả về JSON chuẩn
        "messages": (
            [{"role": "system", "content": SYSTEM_PROMPT}]
            + FEW_SHOT_BATCH_MESSAGES
            + [{"role": "user", "content": _build_batch_user_prompt(batch_items)}]
        ),
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
                raw_results = obj.get("results")
                if not isinstance(raw_results, list):
                    raise ValueError("Model response missing 'results' list")

                mapped: dict[str, dict] = {}
                for item in raw_results:
                    if not isinstance(item, dict):
                        continue
                    rid = str(item.get("review_id", "")).strip()
                    if not rid:
                        continue
                    mapped[rid] = {
                        "human_vệ sinh_label": _sanitize_label(item.get("ve_sinh")),
                        "human_đồ ăn thức uống_label": _sanitize_label(item.get("do_an_thuc_uong")),
                        "human_khách sạn_label": _sanitize_label(item.get("khach_san")),
                        "human_vị trí_label": _sanitize_label(item.get("vi_tri")),
                        "human_phòng ốc_label": _sanitize_label(item.get("phong_oc")),
                        "human_dịch vụ_label": _sanitize_label(item.get("dich_vu")),
                    }

                return mapped
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

    raise RuntimeError(f"LLM batch call failed: {last_error}")


def _default_labels() -> dict:
    return {
        "human_vệ sinh_label": 0,
        "human_đồ ăn thức uống_label": 0,
        "human_khách sạn_label": 0,
        "human_vị trí_label": 0,
        "human_phòng ốc_label": 0,
        "human_dịch vụ_label": 0,
    }


def _build_result_row(row: pd.Series, labels: dict) -> dict:
    relabel_group = str(row.get("relabel_group", ""))

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

    records = _load_existing_progress(df) if RESUME_FROM_EXISTING else []
    start_idx = len(records)

    failures = []
    total = len(df)

    if CHECKPOINT_FILE.exists() and RESUME_FROM_EXISTING:
        try:
            checkpoint = json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
            same_input = str(checkpoint.get("input", "")) == str(INPUT_FILE)
            same_total = int(checkpoint.get("total_rows", -1)) == int(total)
            raw_failures = checkpoint.get("failures", [])
            # Only carry old failures when truly resuming mid-run.
            if start_idx > 0 and same_input and same_total and isinstance(raw_failures, list):
                failures = raw_failures
            else:
                failures = []
        except Exception:
            failures = []

    if start_idx >= total:
        print(f"Nothing to do. Found existing output with {start_idx}/{total} rows.")
    else:
        mode = "Resuming" if RESUME_FROM_EXISTING else "Starting fresh"
        print(f"{mode} from {start_idx}/{total}")

    next_checkpoint_at = min(total, start_idx + CHECKPOINT_EVERY)

    try:
        for batch_start in range(start_idx, total, BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, total)
            batch_items: list[dict] = []
            for idx in range(batch_start, batch_end):
                row = df.iloc[idx]
                batch_items.append(
                    {
                        "idx": idx,
                        "review_id": str(row.get("review_id", "")),
                        "review_text": str(row.get("Review", "")),
                    }
                )

            batch_started_at = time.monotonic()
            try:
                batch_labels = _call_llm_batch(api_key, base_url, model, batch_items)
            except Exception as exc:  # noqa: BLE001
                batch_labels = {}
                for item in batch_items:
                    failures.append({"review_id": item["review_id"], "error": str(exc)})

            for item in batch_items:
                row = df.iloc[item["idx"]]
                review_id = item["review_id"]
                labels = batch_labels.get(review_id)
                if labels is None:
                    if batch_labels:
                        failures.append(
                            {
                                "review_id": review_id,
                                "error": "Missing review_id in batch response; defaulted to 0",
                            }
                        )
                    labels = _default_labels()
                records.append(_build_result_row(row, labels))

            processed = batch_end
            if processed >= next_checkpoint_at or processed == total:
                _write_progress(records, total, failures, done=False)
                print(f"Processed {processed}/{total} (checkpoint saved)")
                while next_checkpoint_at <= processed and next_checkpoint_at < total:
                    next_checkpoint_at += CHECKPOINT_EVERY

            if processed < total:
                elapsed = time.monotonic() - batch_started_at
                if elapsed < MIN_INTERVAL_BETWEEN_REQUESTS_SEC:
                    time.sleep(MIN_INTERVAL_BETWEEN_REQUESTS_SEC - elapsed)
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
