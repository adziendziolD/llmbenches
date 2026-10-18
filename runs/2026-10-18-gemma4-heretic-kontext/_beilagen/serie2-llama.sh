#!/usr/bin/env bash
# Zweiter Durchgang llama.cpp: der erste Lauf (mtp2) stuerzte bei ctx32k rep 3 ab (siehe llamacpp_q8/mtp2-abbruch.*).
# Jetzt ohne Spekulation (baseline) und danach mtp2 noch einmal.
set -u
cd "$(dirname "$0")/.."
G=/home/alex/llmstore/gemma
CTX=147456
TOK=32768,65536,131072
wait_ready() { for i in $(seq 1 300); do [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$1/health)" = 200 ] && return 0; sleep 2; done; return 1; }
vram() { cat /sys/class/drm/card[01]/device/mem_info_vram_used | awk '{printf "%s%.2f", (NR>1?" + ":""), $1/1073741824}'; }
for CFG in baseline mtp2; do
  echo "### llama.cpp Q8_0 $CFG $(date +%T)"
  SPEC=()
  [ $CFG = mtp2 ] && SPEC=(--model-draft $G/gemma4-uncensored-mtp/mtp-gemma-4-31B-it.gguf --spec-type draft-mtp --spec-draft-n-max 2)
  /home/alex/llmstore/software/llama.cpp/rocm/llama-server --host 127.0.0.1 --port 8899 \
    -m $G/gemma4-31b-heretic/gemma-4-31B-it-uncensored-heretic-Q8_0.gguf --mmproj $G/gemma4-31b-heretic/gemma-4-31B-it-mmproj-BF16.gguf \
    --ctx-size $CTX --device ROCm0,ROCm1 --flash-attn on --split-mode tensor --cache-type-k q8_0 --cache-type-v q8_0 \
    --parallel 1 --no-webui "${SPEC[@]}" > llamacpp_q8/$CFG.server.log 2>&1 &
  LP=$!
  if wait_ready 8899; then
    echo "bereit, VRAM $(vram) GiB" | tee -a llamacpp_q8/run.log
    python3 _beilagen/ctxbench.py 8899 gemma $CFG llamacpp_q8 $TOK 3 2>&1 | tail -20 | tee -a llamacpp_q8/run.log
  else echo "llama: nicht bereit"; fi
  kill $LP 2>/dev/null; wait $LP 2>/dev/null; sleep 8
done
echo SERIE-FERTIG
