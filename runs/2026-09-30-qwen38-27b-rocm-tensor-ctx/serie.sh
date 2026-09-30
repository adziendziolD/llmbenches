#!/usr/bin/env bash
# ROCm, Tensor-Split ueber beide R9700, MTP n-max 2, langer Prompt, Kontext 64k bis 256k
cd "$(dirname "$0")"
for c in 65536 131072 196608 262144; do
  env DEVICE=ROCm0,ROCm1 SPLIT=tensor CTX=$c ./mtp-bench.sh ctx$((c/1024))k mtp2
done
echo ALLES-FERTIG
