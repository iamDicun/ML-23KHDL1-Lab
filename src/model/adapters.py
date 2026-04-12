from __future__ import annotations

import torch
import torch.nn as nn
from transformers.models.deberta_v2.modeling_deberta_v2 import DebertaV2Layer


class BottleneckAdapter(nn.Module):
    """Simple bottleneck adapter: down-project, nonlinearity, up-project"""
    def __init__(self, hidden_size: int, bottleneck_dim: int):
        super().__init__()
        self.down = nn.Linear(hidden_size, bottleneck_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(bottleneck_dim, hidden_size)
        self.reset_parameters()

    def reset_parameters(self) -> None:  # ← thêm hàm này vào đây
        nn.init.xavier_uniform_(self.down.weight)
        nn.init.zeros_(self.down.bias)
        nn.init.zeros_(self.up.weight)
        nn.init.zeros_(self.up.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.up(self.act(self.down(x))).to(x.dtype)


class BaseAdapterOutput(nn.Module):
    """Base class for adapter-wrapped output layers (consolidates SelfOutput + FFNOutput)"""
    def __init__(self, base_output: nn.Module, hidden_size: int, bottleneck_dim: int):
        super().__init__()
        self.base = base_output
        self.adapter = BottleneckAdapter(hidden_size, bottleneck_dim)

    def forward(self, hidden_states: torch.Tensor, input_tensor: torch.Tensor) -> torch.Tensor:
        hidden_states = self.base.dense(hidden_states)
        hidden_states = self.base.dropout(hidden_states)
        hidden_states = hidden_states + self.adapter(hidden_states)
        hidden_states = self.base.LayerNorm(hidden_states + input_tensor)
        return hidden_states


class DebertaV2SelfOutputWithAdapter(BaseAdapterOutput):
    """Wrap attention.output and inject adapter before LayerNorm"""
    pass


class DebertaV2OutputWithAdapter(BaseAdapterOutput):
    """Wrap FFN output and inject adapter before LayerNorm"""
    pass

class DebertaV2LayerWithAdapters(nn.Module):
    """Patch one pretrained DebertaV2Layer with Houlsby pre-LN adapters"""

    def __init__(self, hidden_size: int, base_layer: DebertaV2Layer, bottleneck_dim: int):
        super().__init__()
        self.base = base_layer

        # Safety check
        if not hasattr(self.base, "attention") or not hasattr(self.base.attention, "output"):
            raise ValueError("DebertaV2Layer does not expose attention.output")
        if not hasattr(self.base, "output"):
            raise ValueError("DebertaV2Layer does not expose FFN output block")

        self.base.attention.output = DebertaV2SelfOutputWithAdapter(self.base.attention.output, hidden_size, bottleneck_dim)
        self.base.output = DebertaV2OutputWithAdapter(self.base.output, hidden_size, bottleneck_dim)

    def forward(
        self,
        hidden_states: torch.Tensor,
        attention_mask: torch.Tensor,
        query_states=None,
        relative_pos=None,
        rel_embeddings=None,
        output_attentions: bool = False,
    ):
        # Delegate to HF layer forward to keep internal behavior consistent.
        return self.base(
            hidden_states,
            attention_mask,
            query_states=query_states,
            relative_pos=relative_pos,
            rel_embeddings=rel_embeddings,
            output_attentions=output_attentions,
        )

# Replace encoder layers with adapter-wrapped layers (preserves loaded weights in `base`)
def inject_adapters_into_deberta(model: nn.Module, bottleneck_dim: int) -> None:
    hidden_size = model.config.hidden_size
    new_layers = nn.ModuleList()
    for layer in model.encoder.layer:
        new_layers.append(DebertaV2LayerWithAdapters(hidden_size, layer, bottleneck_dim))
    model.encoder.layer = new_layers


def freeze_backbone_except_adapters_and_layernorm(model: nn.Module) -> None:
    """Freeze all backbone parameters, then selectively unfreeze adapters and encoder LayerNorms.

    Freeze strategy (intentional design):
      - Adapters (``.adapter.``): Always unfrozen — these are the primary trainable parameters.
      - Encoder LayerNorms (``encoder.layer.*.LayerNorm``): Unfrozen to allow the model to
        re-calibrate hidden-state distributions after adapter injection.
      - Embedding LayerNorm (``embeddings.LayerNorm``): Kept **frozen** to preserve pretrained
        token-level representations. Unfreezing embeddings would risk destabilizing the input
        space, especially with small fine-tuning datasets.
      - All other backbone weights (attention, FFN, embeddings): Frozen.
    """
    for _, p in model.named_parameters():
        p.requires_grad = False
    for name, p in model.named_parameters():
        is_adapter = ".adapter." in name
        is_encoder_layernorm = name.startswith("encoder.layer") and (
            "LayerNorm" in name or "layer_norm" in name
        )
        if is_adapter or is_encoder_layernorm:
            p.requires_grad = True
