#!/bin/sh
# Leistung beider GPUs alle 0,5 s: Zeitstempel W0 W1
while true; do printf '%s' "$(date +%s.%N)"; for p in /sys/class/drm/card[0-9]*/device/hwmon/hwmon*/power1_average; do printf ' %s' $(( $(cat $p) / 1000000 )); done; echo; sleep 0.5; done
