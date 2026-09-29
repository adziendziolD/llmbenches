#!/usr/bin/env bash
cd "$(dirname "$0")"
./mtp-bench.sh vulkan-p1 baseline
./mtp-bench.sh vulkan-p1 mtp2
echo ALLES-FERTIG
