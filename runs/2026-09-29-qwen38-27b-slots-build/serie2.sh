#!/usr/bin/env bash
cd "$(dirname "$0")"
NEW=/home/alex/llmstore/software/llama.cpp/vulkan/llama-server
MM=/home/alex/llmstore/qwen/qwen3.8-27b-heretic/mmproj-Qwen3.8-27B-Q8_0.gguf
env BIN=$NEW PARALLEL=2 MMPROJ=$MM ./mtp-bench.sh new-p2-preset mtp2
env BIN=$NEW PARALLEL=2 ./mtp-bench.sh new-p2 mtp2
echo ALLES-FERTIG
