#!/usr/bin/env bash
# Matrix: Split-Mode x MTP, Preset-Werte (1 Slot, ctx 262144, q8_0-KV), b11177 Vulkan
cd "$(dirname "$0")"
run() { local d=$1 c=$2; shift 2; env "$@" ./mtp-bench.sh "$d" "$c"; }
run single  mtp2 DEVICE=Vulkan0         SPLIT=none
run layer   mtp2 DEVICE=Vulkan0,Vulkan1 SPLIT=layer
run tensor  mtp2 DEVICE=Vulkan0,Vulkan1 SPLIT=tensor
run single  baseline DEVICE=Vulkan0         SPLIT=none
run layer   baseline DEVICE=Vulkan0,Vulkan1 SPLIT=layer
run tensor  baseline DEVICE=Vulkan0,Vulkan1 SPLIT=tensor
echo ALLES-FERTIG
