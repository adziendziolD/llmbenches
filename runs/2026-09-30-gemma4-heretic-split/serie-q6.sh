#!/usr/bin/env bash
# Gemma-4-31B Heretic Q6_K mit mmproj, 1 Slot, ohne MTP (kein Head).
# Vulkan Einzelkarte bei ctx 65536 ist das bisherige Preset, die uebrigen Laeufe ctx 131072 auf zwei R9700.
cd "$(dirname "$0")"
G=/home/alex/llmstore/gemma/gemma4-31b-heretic
VK=/home/alex/llmstore/software/llama.cpp/vulkan/llama-server
export MODEL=$G/gemma-4-31B-it-uncensored-heretic-Q6_K.gguf MMPROJ=$G/gemma-4-31B-it-mmproj-BF16.gguf
BIN=$VK DEVICE=Vulkan0         SPLIT=none  CTX=65536  ./mtp-bench.sh q6-vulkan-single baseline
BIN=$VK DEVICE=Vulkan0,Vulkan1 SPLIT=layer CTX=131072 ./mtp-bench.sh q6-vulkan-layer  baseline
DEVICE=ROCm0,ROCm1 SPLIT=layer  CTX=131072 ./mtp-bench.sh q6-rocm-layer  baseline
DEVICE=ROCm0,ROCm1 SPLIT=tensor CTX=131072 ./mtp-bench.sh q6-rocm-tensor baseline
echo ALLES-FERTIG
