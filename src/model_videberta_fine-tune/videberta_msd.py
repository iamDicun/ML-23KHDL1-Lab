"""ViDeBERTa encoder + multi-pooling + multi-rate MSD + six shared aspect heads"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from .adapters import (
    freeze_backbone_except_adapters_and_layernorm,
    inject_adapters_into_deberta,
    unfreeze_last_n_encoder_layers,
)
from .config import ASPECTS, TrainConfig
from .hf_videberta import load_deberta_v2_encoder

def _semantic_pool_mask(attention_mask: torch.Tensor) -> torch.Tensor:
    """Build a mask that excludes [CLS] and final [SEP] tokens for semantic pooling"""
    if attention_mask.dim() != 2:
        raise ValueError(f"attention_mask must be [B, L], got {tuple(attention_mask.shape)}")

    token_mask = attention_mask.bool().clone()
    if token_mask.size(1) == 0:
        return token_mask

    # Exclude [CLS] at index 0
    token_mask[:, 0] = False

    # Exclude the last valid token (typically [SEP])
    lengths = attention_mask.long().sum(dim=1)
    last_valid_idx = (lengths - 1).clamp(min=0)
    rows = torch.arange(token_mask.size(0), device=token_mask.device)
    # Need at least 2 valid tokens to have a distinct final token from [CLS]
    valid_rows = lengths > 1
    token_mask[rows[valid_rows], last_valid_idx[valid_rows]] = False

    # Degenerate rows (e.g. [CLS] only, [CLS][SEP]) have no semantic tokens
    # Keep [CLS] as a stable fallback so pooling remains defined
    empty_rows = ~token_mask.any(dim=1)
    if empty_rows.any():
        token_mask[empty_rows] = False
        token_mask[empty_rows, 0] = attention_mask[empty_rows, 0].bool()

    return token_mask


def _mean_pool_with_mask(hidden: torch.Tensor, mask_3d: torch.Tensor) -> torch.Tensor:
    """Mean-pool over sequence dim using a pre-computed [B, L, 1] float mask"""
    summed = (hidden * mask_3d).sum(dim=1)
    denom = mask_3d.sum(dim=1).clamp(min=1e-6)
    return summed / denom


def _max_pool_with_mask(hidden: torch.Tensor, mask_3d: torch.Tensor) -> torch.Tensor:
    """Max-pool over sequence dim using a pre-computed [B, L, 1] bool-like mask"""
    fill_value = torch.finfo(hidden.dtype).min
    masked_hidden = hidden.masked_fill(mask_3d == 0, fill_value)
    pooled = masked_hidden.max(dim=1).values

    empty_rows = ~(mask_3d.squeeze(-1).bool()).any(dim=1)
    if empty_rows.any():
        pooled[empty_rows] = 0.0
    return pooled

class ViDeBERTaAspectMSD(nn.Module):
    """ViDeBERTa encoder + multi-pooling + multi-rate MSD + six shared aspect heads"""
    def __init__(self, cfg: TrainConfig, class_weights: torch.Tensor | None = None):
        super().__init__()
        self.cfg = cfg

        # Register class_weights as a buffer so it moves with the model and is visible in DataParallel
        if class_weights is not None:
            self.register_buffer("class_weights", class_weights)  # [num_aspects, C]
        else:
            self.class_weights = None

        # Load the DeBERTa v2 backbone
        self.backbone = load_deberta_v2_encoder(cfg.model_name)

        if not hasattr(self.backbone, "encoder") or not hasattr(self.backbone.encoder, "layer"):
            raise ValueError(
                f"Backbone must expose encoder.layer (DeBERTa v2 style); got {type(self.backbone)}"
            )
        
        # Inject adapters, freeze backbone except adapters and LayerNorm, and unfreeze last N encoder layers
        inject_adapters_into_deberta(self.backbone, cfg.adapter_bottleneck_dim)
        freeze_backbone_except_adapters_and_layernorm(self.backbone)
        unfreeze_last_n_encoder_layers(self.backbone, cfg.unfreeze_encoder_layers)

        # Determine pooled_dim based on whether multi-pooling is used
        h = self.backbone.config.hidden_size
        self.pooled_dim = 3 * h if cfg.use_multipool else h

        # Derive num_aspects from ASPECTS
        self.num_aspects = len(ASPECTS)

        # Create a separate linear head for each aspect, all sharing the same pooled_dim input size
        self.aspect_heads = nn.ModuleList(
            [nn.Linear(self.pooled_dim, cfg.num_classes_per_aspect) for _ in range(self.num_aspects)]
        )

        # Unfreeze aspect heads so they are trainable
        for p in self.aspect_heads.parameters():
            p.requires_grad = True


    def pool(self, hidden_states: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        """Apply multi-pooling to hidden states, returning a tensor of shape [B, pooled_dim]"""
        # Extract [CLS] token representation as a stable baseline pool
        cls_vec = hidden_states[:, 0, :]

        if not self.cfg.use_multipool:
            return cls_vec
        
        mask_3d = _semantic_pool_mask(attention_mask).unsqueeze(-1).to(hidden_states.dtype)
        mean_vec = _mean_pool_with_mask(hidden_states, mask_3d)
        max_vec = _max_pool_with_mask(hidden_states, mask_3d)
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

        # During evaluation, skip MSD and return logits from a single forward pass for monitoring/logging
        if not self.training:
            logits_stacked = self._heads_forward(v)
            loss = None
            if labels is not None:
                loss = self._mean_aspect_ce(logits_stacked, labels)
            return {"loss": loss, "logits": logits_stacked}

        # During training, compute MSD loss if labels are provided; otherwise return logits without MSD loss computation
        if labels is None:
            return {"loss": None, "logits": self._heads_forward(v)}

        # If MSD is disabled, compute loss from a single forward pass
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

        # Logits returned during MSD training are computed under torch.no_grad().
        # They are used ONLY for monitoring/logging (e.g. validation macro-F1 display),
        # NOT for loss computation. If downstream code ever needs gradients from these
        # logits, this block must be removed.
        with torch.no_grad():
            logits_eval = self._heads_forward(v)
        return {"loss": loss, "logits": logits_eval}

    def _heads_forward(self, v: torch.Tensor) -> torch.Tensor:
        """Run the aspect heads on the pooled vector v to get logits for each aspect; returns [B, 6, C]"""
        return torch.stack([head(v) for head in self.aspect_heads], dim=1)

    def _mean_aspect_ce(self, logits: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        """
            Compute mean cross-entropy loss across all aspects
            logits [B, num_aspects, C], labels [B, num_aspects]
        """
        b, a, c = logits.shape
        losses = []
        for i in range(a):
            w = self.class_weights[i] if self.class_weights is not None else None
            losses.append(
                F.cross_entropy(logits[:, i, :], labels[:, i].long(), weight=w, label_smoothing=0.1)
            )
        # Return [1] tensor instead of scalar so DataParallel's gather can concatenate per-replica losses along dim 0
        return torch.stack(losses).mean().unsqueeze(0)

    @property
    def hidden_size(self) -> int:
        return self.backbone.config.hidden_size
