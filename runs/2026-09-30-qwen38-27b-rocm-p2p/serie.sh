#!/usr/bin/env bash
# Matrix: Split-Mode x P2P x MTP auf ROCm (b11177), Preset-Werte (1 Slot, ctx 262144, q8_0-KV)
cd "$(dirname "$0")"
run() { local d=$1 c=$2; shift 2; env "$@" ./mtp-bench.sh "$d" "$c"; }
for c in mtp2 baseline; do
  run single        $c DEVICE=ROCm0        SPLIT=none
  run layer         $c DEVICE=ROCm0,ROCm1  SPLIT=layer
  run layer-p2p     $c DEVICE=ROCm0,ROCm1  SPLIT=layer  GGML_CUDA_P2P=1
  run tensor        $c DEVICE=ROCm0,ROCm1  SPLIT=tensor
  run tensor-p2p    $c DEVICE=ROCm0,ROCm1  SPLIT=tensor GGML_CUDA_P2P=1
done
echo ALLES-FERTIG
