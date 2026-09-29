#!/usr/bin/env bash
# Matrix: Build x Slots x kv-unified x mmproj, immer mtp2 (eingebetteter Head), ctx 262144
cd "$(dirname "$0")"
NEW=/home/alex/llmstore/software/llama.cpp/vulkan/llama-server
OLD=/home/alex/llmstore/software/llama.cpp/vulkan-mtp/llama-server
MM=/home/alex/llmstore/qwen/qwen3.8-27b-heretic/mmproj-Qwen3.8-27B-Q8_0.gguf
run() { # ordner cfg env...
  local d=$1 c=$2; shift 2
  env "$@" ./mtp-bench.sh "$d" "$c"
}
run new-p1            baseline BIN=$NEW PARALLEL=1
run new-p1            mtp2     BIN=$NEW PARALLEL=1
run new-p3-preset     mtp2     BIN=$NEW PARALLEL=3 MMPROJ=$MM
run new-p3-kvu        mtp2     BIN=$NEW PARALLEL=3 KVU=yes
run new-p3-nokvu      mtp2     BIN=$NEW PARALLEL=3 KVU=no
run new-p1-kvu        mtp2     BIN=$NEW PARALLEL=1 KVU=yes
run old-p1            mtp2     BIN=$OLD PARALLEL=1
run old-p3            mtp2     BIN=$OLD PARALLEL=3
echo ALLES-FERTIG
