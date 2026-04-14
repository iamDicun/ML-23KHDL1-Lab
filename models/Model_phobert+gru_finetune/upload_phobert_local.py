"""Upload the entire Model_2/phobert_local folder to Hugging Face Hub.

By default, the script reads the Hugging Face token from `Model_2/token.txt`.
You can still override it with the `--token` command-line argument.

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

try:
    from huggingface_hub import HfApi, create_repo
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: huggingface_hub. Install it with `pip install huggingface_hub`."
    ) from exc


BASE_DIR = Path(__file__).resolve().parent
SOURCE_DIR = BASE_DIR / "phobert_local"
TOKEN_FILE = BASE_DIR / "token.txt"

# Fill these in later if you want to use the script without CLI args.
REPO_ID = "Nhat1106/phobert-repo"
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
        default=None,
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


def load_token_from_file(token_file: Path = TOKEN_FILE) -> str:
    if not token_file.is_file():
        raise FileNotFoundError(f"Token file not found: {token_file}")

    token = token_file.read_text(encoding="utf-8").strip()
    if not token:
        raise ValueError(f"Token file is empty: {token_file}")

    return token


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

    token = args.token or load_token_from_file()

    if not args.repo_id or "your-username" in args.repo_id:
        raise ValueError("Please set --repo-id to your real Hugging Face repository id.")
    if not token or token.startswith("hf_your_token_here"):
        raise ValueError("Please set --token to your real Hugging Face access token.")

    api = HfApi(token=token)

    print(f"Creating or reusing repo: {args.repo_id}")
    create_repo(
        repo_id=args.repo_id,
        token=token,
        private=args.private,
        exist_ok=True,
    )

    print(f"Uploading folder: {SOURCE_DIR}")
    api.upload_folder(
        folder_path=str(SOURCE_DIR),
        repo_id=args.repo_id,
        repo_type="model",
        token=token,
        revision=args.revision,
    )

    print("Upload complete.")
    print(f"Repo: https://huggingface.co/{args.repo_id}")


if __name__ == "__main__":
    main()
