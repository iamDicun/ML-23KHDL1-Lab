"""Upload the entire Model_2/phobert_local folder to Hugging Face Hub.

Fill in `REPO_ID` and `HF_TOKEN` below, or pass them via command-line args.

Example:
    python Model_2/upload_phobert_local.py \
        --repo-id your-username/your-phobert-repo \
        --token hf_xxx

This script uploads the full local PhoBERT folder as-is, including:
- config.json
- model.safetensors
- tokenizer files
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

try:
    from huggingface_hub import HfApi, create_repo
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: huggingface_hub. Install it with `pip install huggingface_hub`."
    ) from exc


BASE_DIR = Path(__file__).resolve().parent
SOURCE_DIR = BASE_DIR / "phobert_local"

# Fill these in later if you want to use the script without CLI args.
REPO_ID = "Nhat1106/phobert-repo"
HF_TOKEN = "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"
PRIVATE = False


def parse_args():
    parser = argparse.ArgumentParser(description="Upload Model_2/phobert_local to Hugging Face Hub.")
    parser.add_argument(
        "--repo-id",
        type=str,
        default=REPO_ID,
        help="Hugging Face repo id, e.g. username/phobert-local",
    )
    parser.add_argument(
        "--token",
        type=str,
        default=HF_TOKEN,
        help="Hugging Face access token",
    )
    parser.add_argument(
        "--private",
        action="store_true",
        default=PRIVATE,
        help="Create the repo as private",
    )
    parser.add_argument(
        "--revision",
        type=str,
        default="main",
        help="Branch or revision name on the Hub",
    )
    return parser.parse_args()


def validate_source_dir() -> None:
    if not SOURCE_DIR.is_dir():
        raise FileNotFoundError(f"Source folder not found: {SOURCE_DIR}")

    required_files = ["config.json", "model.safetensors", "vocab.txt", "bpe.codes"]
    missing = [name for name in required_files if not (SOURCE_DIR / name).is_file()]
    if missing:
        raise FileNotFoundError(
            f"Missing required files in {SOURCE_DIR}: {missing}. "
            "Make sure `download_model.py` finished successfully."
        )


def main():
    args = parse_args()
    validate_source_dir()

    if not args.repo_id or "your-username" in args.repo_id:
        raise ValueError("Please set --repo-id to your real Hugging Face repository id.")
    if not args.token or args.token.startswith("hf_your_token_here"):
        raise ValueError("Please set --token to your real Hugging Face access token.")

    api = HfApi(token=args.token)

    print(f"Creating or reusing repo: {args.repo_id}")
    create_repo(
        repo_id=args.repo_id,
        token=args.token,
        private=args.private,
        exist_ok=True,
    )

    print(f"Uploading folder: {SOURCE_DIR}")
    api.upload_folder(
        folder_path=str(SOURCE_DIR),
        repo_id=args.repo_id,
        repo_type="model",
        token=args.token,
        revision=args.revision,
    )

    print("Upload complete.")
    print(f"Repo: https://huggingface.co/{args.repo_id}")


if __name__ == "__main__":
    main()
