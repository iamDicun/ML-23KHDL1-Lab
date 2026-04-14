"""Load ViDeBERTa encoder checkpoints from Hugging Face Hub"""

from __future__ import annotations

import logging
import torch.nn as nn
from transformers import AutoModel

logger = logging.getLogger(__name__)


def load_deberta_v2_encoder(model_name: str) -> nn.Module:
    """Load the ViDeBERTa encoder from Hugging Face Hub and convert to float32"""
    logger.info(f"Loading model: {model_name}")
    model = AutoModel.from_pretrained(model_name)
    logger.info(f"Model loaded successfully")
    return model.float()
