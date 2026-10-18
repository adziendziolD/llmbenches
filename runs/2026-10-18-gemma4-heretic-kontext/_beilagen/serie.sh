#!/usr/bin/env bash
# Gemma-4-31B Heretic, Kontext 32k/64k/128k: llama.cpp (Q8_0, ROCm, Tensor-Split, MTP-Draft) gegen Radiance (w8a8, --tp 2).
# Beide mit Kontext 147456, damit 131072 Prompt-Token plus Antwort hineinpassen.
set -u
cd "$(dirname "$0")/.."
OUT=$PWD
G=/home/alex/llmstore/gemma
CTX=147456
TOK=32768,65536,131072
wait_ready() { for i in $(seq 1 300); do [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$1/health)" = 200 ] && return 0; sleep 2; done; return 1; }
vram() { cat /sys/class/drm/card[01]/device/mem_info_vram_used | awk '{printf "%s%.2f", (NR>1?" + ":""), $1/1073741824}'; }

~/git/llm-router/scripts/radiance stop >/dev/null 2>&1
llama-launcher stop server-multi >/dev/null 2>&1

echo "### llama.cpp Q8_0 mtp2 $(date +%T)"
mkdir -p llamacpp_q8_mtp2
/home/alex/llmstore/software/llama.cpp/rocm/llama-server --host 127.0.0.1 --port 8899 \
  -m $G/gemma4-31b-heretic/gemma-4-31B-it-uncensored-heretic-Q8_0.gguf --mmproj $G/gemma4-31b-heretic/gemma-4-31B-it-mmproj-BF16.gguf \
  --ctx-size $CTX --device ROCm0,ROCm1 --flash-attn on --split-mode tensor --cache-type-k q8_0 --cache-type-v q8_0 \
  --parallel 1 --no-webui --model-draft $G/gemma4-uncensored-mtp/mtp-gemma-4-31B-it.gguf --spec-type draft-mtp --spec-draft-n-max 2 \
  > llamacpp_q8_mtp2/baseline.server.log 2>&1 &
LP=$!
if wait_ready 8899; then
  echo "bereit, VRAM $(vram) GiB" | tee -a llamacpp_q8_mtp2/run.log
  python3 _beilagen/ctxbench.py 8899 gemma baseline llamacpp_q8_mtp2 $TOK 3 2>&1 | tee -a llamacpp_q8_mtp2/run.log
else echo "llama: nicht bereit"; fi
kill $LP; wait $LP 2>/dev/null; sleep 8

echo "### Radiance w8a8 $(date +%T)"
mkdir -p radiance_w8a8
RADIANCE_CTX=$CTX ~/git/llm-router/scripts/radiance start gemma4-31b-heretic-radiance > radiance_w8a8/start.out 2>&1
if wait_ready 8951; then
  cp ~/git/llm-router/../radiance-work/radiance-router.log radiance_w8a8/baseline.server.log 2>/dev/null
  echo "bereit, VRAM $(vram) GiB" | tee -a radiance_w8a8/run.log
  python3 _beilagen/ctxbench.py 8951 gemma4-31b-heretic-radiance baseline radiance_w8a8 $TOK 3 2>&1 | tee -a radiance_w8a8/run.log
  cp ~/radiance-work/radiance-router.log radiance_w8a8/baseline.server.log 2>/dev/null
else echo "radiance: nicht bereit"; fi
~/git/llm-router/scripts/radiance stop >/dev/null 2>&1
echo SERIE-FERTIG
