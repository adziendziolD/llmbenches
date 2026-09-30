#!/usr/bin/env bash
# Q8_0 gegen Q6_K, ROCm Tensor-Split ueber beide R9700, ctx 262144, 1 Slot
cd "$(dirname "$0")"
Q=/home/alex/llmstore/qwen/qwen3_8
run() { local d=$1 c=$2 m=$3; ./mtp-bench.sh "$d" "$c"; }
export DEVICE=ROCm0,ROCm1 SPLIT=tensor CTX=262144
MODEL=$Q/Qwen3.8-27B-Q8_0.gguf     ./mtp-bench.sh q8 mtp2
MODEL=$Q/Qwen3.8-27B-UD-Q6_K.gguf  ./mtp-bench.sh q6 mtp2
MODEL=$Q/Qwen3.8-27B-Q8_0.gguf     ./mtp-bench.sh q8 baseline
MODEL=$Q/Qwen3.8-27B-UD-Q6_K.gguf  ./mtp-bench.sh q6 baseline
echo ALLES-FERTIG
