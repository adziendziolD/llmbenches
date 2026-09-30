#!/usr/bin/env bash
# Gemma-4-31B Heretic Q8_0 mit mmproj, ROCm Tensor-Split ueber zwei R9700, ctx 131072, 1 Slot.
# Kein eigener MTP-Head, mtp2 nutzt den Assistant-Draft der HauhauCS-Variante.
cd "$(dirname "$0")"
G=/home/alex/llmstore/gemma
export MODEL=$G/gemma4-31b-heretic/gemma-4-31B-it-uncensored-heretic-Q8_0.gguf MMPROJ=$G/gemma4-31b-heretic/gemma-4-31B-it-mmproj-BF16.gguf CTX=131072
DRAFT=$G/gemma4-uncensored-mtp/mtp-gemma-4-31B-it.gguf DEVICE=ROCm0,ROCm1 SPLIT=tensor ./mtp-bench.sh q8-rocm-tensor mtp2
echo ALLES-FERTIG
