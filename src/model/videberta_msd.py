"""ViDeBERTa encoder + multi-pooling + multi-rate MSD + six shared aspect heads"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from .adapters import freeze_backbone_except_adapters_and_layernorm, inject_adapters_into_deberta
from .config import TrainConfig
from .hf_videberta import load_deberta_v2_encoder

def _semantic_pool_mask(attention_mask: torch.Tensor) -> torch.Tensor:
    """Build a mask that excludes [CLS] and final [SEP] tokens for semantic pooling."""
    if attention_mask.dim() != 2:
        raise ValueError(f"attention_mask must be [B, L], got {tuple(attention_mask.shape)}")

    token_mask = attention_mask.bool().clone()
    if token_mask.size(1) == 0:
        return token_mask

    # Exclude [CLS] at index 0.
    token_mask[:, 0] = False

    # Exclude the last valid token (typically [SEP]).
    lengths = attention_mask.long().sum(dim=1)
    last_valid_idx = (lengths - 1).clamp(min=0)
    rows = torch.arange(token_mask.size(0), device=token_mask.device)
    # Need at least 2 valid tokens to have a distinct final token from [CLS].
    valid_rows = lengths > 1
    token_mask[rows[valid_rows], last_valid_idx[valid_rows]] = False

    # Degenerate rows (e.g. [CLS] only, [CLS][SEP]) have no semantic tokens.
    # Keep [CLS] as a stable fallback so pooling remains defined.
    empty_rows = ~token_mask.any(dim=1)
    if empty_rows.any():
        token_mask[empty_rows] = False
        token_mask[empty_rows, 0] = attention_mask[empty_rows, 0].bool()

    return token_mask


# Calculate mean pooling over the sequence dimension, ignoring padding and special tokens.
# hidden: [B, L, H], mask: [B, L] with 1 for real tokens
def masked_mean_pool(hidden: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    mask = _semantic_pool_mask(attention_mask).unsqueeze(-1).to(hidden.dtype)
    summed = (hidden * mask).sum(dim=1)
    denom = mask.sum(dim=1).clamp(min=1e-6)
    return summed / denom

# Calculate max pooling over the sequence dimension, ignoring padding and special tokens.
def masked_max_pool(hidden: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    mask = _semantic_pool_mask(attention_mask).unsqueeze(-1)
    fill_value = torch.finfo(hidden.dtype).min
    masked_hidden = hidden.masked_fill(~mask, fill_value)
    pooled = masked_hidden.max(dim=1).values

    empty_rows = ~mask.squeeze(-1).any(dim=1)
    if empty_rows.any():
        pooled[empty_rows] = 0.0
    return pooled


class ViDeBERTaAspectMSD(nn.Module):
    """ViDeBERTa encoder + multi-pooling + multi-rate MSD + six shared aspect heads"""
    def __init__(self, cfg: TrainConfig, class_weights: torch.Tensor | None = None):
        super().__init__()
        self.cfg = cfg

        if class_weights is not None:
            self.register_buffer("class_weights", class_weights)  # [6, 3]
        else:
            self.class_weights = None

        self.backbone = load_deberta_v2_encoder(cfg.model_name)
        if not hasattr(self.backbone, "encoder") or not hasattr(self.backbone.encoder, "layer"):
            raise ValueError(
                f"Backbone must expose encoder.layer (DeBERTa v2 style); got {type(self.backbone)}"
            )
        inject_adapters_into_deberta(self.backbone, cfg.adapter_bottleneck_dim)
        freeze_backbone_except_adapters_and_layernorm(self.backbone)

        h = self.backbone.config.hidden_size
        self.pooled_dim = 3 * h if cfg.use_multipool else h
        self.num_aspects = 6
        self.aspect_heads = nn.ModuleList(
            [nn.Linear(self.pooled_dim, cfg.num_classes_per_aspect) for _ in range(self.num_aspects)]
        )

        for p in self.aspect_heads.parameters():
            p.requires_grad = True

    # Multi-pooling: concatenate CLS, mean pool, and max pool
    def pool(self, hidden_states: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        cls_vec = hidden_states[:, 0, :]
        if not self.cfg.use_multipool:
            return cls_vec
        mean_vec = masked_mean_pool(hidden_states, attention_mask)
        max_vec = masked_max_pool(hidden_states, attention_mask)
        return torch.cat([cls_vec, mean_vec, max_vec], dim=-1)

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        labels: torch.Tensor | None = None,
    ) -> dict[str, torch.Tensor | None]:
        out = self.backbone(input_ids=input_ids, attention_mask=attention_mask)
        hidden = out.last_hidden_state

        # Pooling to get [B, pooled_dim]
        v = self.pool(hidden, attention_mask)

        if not self.training:
            logits_stacked = self._heads_forward(v)
            loss = None
            if labels is not None:
                loss = self._mean_aspect_ce(logits_stacked, labels)
            return {"loss": loss, "logits": logits_stacked}

        if labels is None:
            return {"loss": None, "logits": self._heads_forward(v)}

        # True no-MSD path: one forward pass only.
        if not self.cfg.use_msd:
            logits = self._heads_forward(v)
            loss = self._mean_aspect_ce(logits, labels)
            return {"loss": loss, "logits": logits}

        losses = []
        for p_drop in self.cfg.msd_rates():
            v_k = F.dropout(v, p=p_drop, training=True)
            logits_k = self._heads_forward(v_k)
            losses.append(self._mean_aspect_ce(logits_k, labels))
        loss = torch.stack(losses, dim=0).mean()
        with torch.no_grad():
            logits_eval = self._heads_forward(v)
        return {"loss": loss, "logits": logits_eval}

    # Run the aspect heads on the pooled vector v to get logits for each aspect; returns [B, 6, C]
    def _heads_forward(self, v: torch.Tensor) -> torch.Tensor:
        return torch.stack([head(v) for head in self.aspect_heads], dim=1)

    def _mean_aspect_ce(self, logits: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        # logits [B, 6, C], labels [B, 6]
        b, a, c = logits.shape
        losses = []
        for i in range(a):
            w = self.class_weights[i] if self.class_weights is not None else None
            losses.append(
                F.cross_entropy(logits[:, i, :], labels[:, i].long(), weight=w, label_smoothing=0.1)
            )
        return torch.stack(losses).mean()

    @property
    def hidden_size(self) -> int:
        return self.backbone.config.hidden_size
