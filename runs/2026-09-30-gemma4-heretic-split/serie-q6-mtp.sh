#!/usr/bin/env bash
# Gemma-4-31B Heretic Q6_K mit dem Assistant-Draft der HauhauCS-Variante (MTP n-max 2), ROCm Tensor-Split
cd "$(dirname "$0")"
G=/home/alex/llmstore/gemma
export MODEL=$G/gemma4-31b-heretic/gemma-4-31B-it-uncensored-heretic-Q6_K.gguf MMPROJ=$G/gemma4-31b-heretic/gemma-4-31B-it-mmproj-BF16.gguf DRAFT=$G/gemma4-uncensored-mtp/mtp-gemma-4-31B-it.gguf
DEVICE=ROCm0,ROCm1 SPLIT=tensor CTX=131072 ./mtp-bench.sh q6-rocm-tensor mtp2
echo ALLES-FERTIG
