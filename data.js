// erzeugt von tools/collect.py, nicht von Hand aendern
window.BENCH_DATA = {
 "generated": "2026-09-14T09:58:43+02:00",
 "runs": [
  {
   "id": "2026-09-14-qwen38-27b-mtp",
   "title": "MTP-Speculative-Decoding, Qwen3.8-27B (dicht, qwen35)",
   "date": "2026-09-14",
   "question": "Bringt der MTP-Draft-Head auch beim dichten Qwen3.8-27B Durchsatz, welches --spec-draft-n-max ist optimal, und wie viel davon kostet jeder zusaetzliche Server-Slot?",
   "machine": {
    "GPU": "AMD Radeon AI PRO R9700, gfx1201, 31,86 GiB VRAM",
    "CPU": "AMD Ryzen Threadripper PRO 3975WX, 32 Kerne",
    "RAM": "61 GiB",
    "OS": "Ubuntu 26.04, Kernel 7.0"
   },
   "model": {
    "Modell": "Qwen3.8-27B-UD-Q6_K (20,5 GiB, Architektur qwen35, dicht)",
    "Draft-Head": "mtp-Qwen3.8-27B-shared-Q6_K.gguf (345 MiB, selbst extrahiert)",
    "Herkunft des Heads": "selbst geschnitten aus blk.64, siehe tools/extract-mtp.py",
    "Build": "Unsloth-Fork, ~/llmstore/software/llama.cpp/vulkan-mtp/"
   },
   "method": {
    "Kontext": "262144, cache-type-k/v q8_0, flash-attn on",
    "Sampling": "greedy (temperature 0, top_k 1, seed 42), cache_prompt false",
    "Messung": "3 Prompt-Typen x 4 Wiederholungen je Konfiguration, 256 Tokens, ein Warmlauf vorab",
    "Kennzahl": "Median der Einzelwerte"
   },
   "cmdline": "llama-server -m Qwen3.8-27B-UD-Q6_K.gguf --device Vulkan0 --ctx-size 262144 --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0 --parallel N [--kv-unified] [-md MTP/mtp-Qwen3.8-27B-shared-Q6_K.gguf --spec-type draft-mtp --spec-draft-n-max N]",
   "backends": {
    "vulkan": {
     "label": "Vulkan, 1 Slot",
     "device": "Vulkan0",
     "detail": "--parallel 1. Vergleichbar mit der Flash-Next-Reihe vom 2026-09-13."
    },
    "vulkan-p2": {
     "label": "Vulkan, 2 Slots",
     "device": "Vulkan0",
     "detail": "--parallel 2 --kv-unified. Mittelweg zwischen einem Slot (voller MTP-Gewinn) und drei Slots (mehr Nebenlaeufigkeit)."
    },
    "vulkan-p3": {
     "label": "Vulkan, 3 Slots",
     "device": "Vulkan0",
     "detail": "--parallel 3 --kv-unified, also die Konfiguration des Katalogpresets qwen3.8-27b-code. Anfragen laufen trotzdem einzeln; gemessen wird, ob die blosse Existenz von drei Slots den MTP-Gewinn kostet."
    }
   },
   "configs": {
    "baseline": {
     "label": "ohne MTP",
     "order": 0
    },
    "mtp1": {
     "label": "MTP n-max 1",
     "order": 1
    },
    "mtp2": {
     "label": "MTP n-max 2",
     "order": 2
    },
    "mtp3": {
     "label": "MTP n-max 3",
     "order": 3
    }
   },
   "prompts": {
    "code": "Python-Klasse fuer einen LRU-Cache mit Typannotationen und Komplexitaetsanalyse",
    "prosa": "Fliesstext zur Heizkostenabrechnung in einer WEG",
    "reasoning": "Einholvorgang zweier Zuege, Schritt fuer Schritt mit Gegenprobe"
   },
   "notes": [
    "MTP wirkt beim dichten 27B deutlich staerker als beim MoE Flash-Next: 1,89x gegen 1,48x. Plausibel, weil bei einem dichten Modell jeder verworfene Token einen vollen Vorwaertslauf ueber 20,5 GiB kostet, der Draft-Head aber nur 345 MiB gross ist.",
    "Bei einem Slot ist n-max 2 das Optimum (1,89x). n-max 3 bringt nichts mehr (1,87x) und kostet Akzeptanz: 0,569 gegen 0,672. n-max 1 liegt bei 1,53x, hat aber mit 0,819 die hoechste Akzeptanz.",
    "Zwei Slots kosten so gut wie nichts: mtp2 faellt von 46,23 auf 45,78 t/s, also rund ein Prozent, bei doppelter Nebenlaeufigkeit. Das ist der Betriebspunkt mit dem besten Verhaeltnis.",
    "Drei Slots brechen mtp2 auf 32,30 t/s ein (1,28x). Nachgemessen in einem zweiten Lauf: 31,51 t/s bei identischer Akzeptanz 0,651, der Einbruch ist also reproduzierbar und kein Ausreisser.",
    "Der Einbruch liegt nicht an der Draft-Qualitaet: die Akzeptanz bleibt ueber alle Slotzahlen fast konstant (0,672 bei einem, 0,651 bei drei Slots). Es ist die Verifikation, die langsamer wird. Die Ursache ist aus den Logs dieser Reihe nicht zu belegen.",
    "n-max 1 ist von der Slotzahl voellig unberuehrt: 1,53x bei einem, zwei und drei Slots, Akzeptanz jedes Mal exakt 0,819. Die Slotzahl trifft MTP also nicht pauschal, sondern nur groessere Draft-Laengen.",
    "Die Baseline ist von der Slotzahl ebenfalls unberuehrt (24,47 / 25,20 / 25,18 t/s). Wer kein MTP faehrt, zahlt fuer zusaetzliche Slots nichts.",
    "Fuer qwen35 gibt es keinen veroeffentlichten Draft-Head. Unsloth liefert nur fuer qwen4exp (Flash-Next) einen und schreibt ausdruecklich 'for Qwen3.8-Flash-Next only'. Der hier benutzte Head ist mit tools/extract-mtp.py aus blk.64 des Modells selbst geschnitten, tensorweise byte-identisch zum Original.",
    "Das Modell als eigenen Draft zu uebergeben (-md auf dieselbe Datei) funktioniert, ist aber die falsche Loesung: 11,36 statt 25,12 t/s bei ctx 8192, also 0,45x, und +10 GiB VRAM. llama.cpp laedt dann ein zweites vollstaendiges Modell statt nur des nextn-Layers.",
    "VRAM wird eng: Baseline 28,4 bis 28,7 GiB, mit MTP 30,6 bis 31,2 GiB von 31,86 GiB. Dazu rechnet --fit den Draft-Head bekanntermassen nicht ein ('failed to measure the memory of the extra model, fitting without it'). Auf dieser Karte ging es gut; eine Marge per --fit-target ist ratsam, wie in der ROCm-Reihe vom 2026-09-13.",
    "Die Streuung ist bei MTP deutlich groesser als ohne (mtp3: 41,26 bis 52,11 t/s gegen baseline 24,34 bis 24,69), weil die Akzeptanzrate am Prompt haengt. Nach Prompt-Typ bei mtp2 und einem Slot: Reasoning 2,00x, Prosa 1,89x, Code 1,69x. Ausgerechnet Code profitiert am wenigsten."
   ],
   "results": {
    "vulkan": {
     "baseline": {
      "status": "ok",
      "vram_gib": 28.43,
      "prompts": {
       "code": {
        "n": 4,
        "min": 24.47,
        "median": 24.55,
        "max": 24.69,
        "mean": 24.56,
        "spread_pct": 0.9,
        "values": [
         24.69,
         24.59,
         24.47,
         24.51
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 265.8,
        "speedup": 1.0
       },
       "prosa": {
        "n": 4,
        "min": 24.34,
        "median": 24.44,
        "max": 24.69,
        "mean": 24.48,
        "spread_pct": 1.4,
        "values": [
         24.42,
         24.34,
         24.47,
         24.69
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 269.3,
        "speedup": 1.0
       },
       "reasoning": {
        "n": 4,
        "min": 24.34,
        "median": 24.43,
        "max": 24.62,
        "mean": 24.45,
        "spread_pct": 1.1,
        "values": [
         24.62,
         24.34,
         24.46,
         24.4
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 353.2,
        "speedup": 1.0
       }
      },
      "overall": {
       "n": 12,
       "min": 24.34,
       "median": 24.47,
       "max": 24.69,
       "mean": 24.5,
       "spread_pct": 1.4,
       "values": [
        24.69,
        24.59,
        24.47,
        24.51,
        24.42,
        24.34,
        24.47,
        24.69,
        24.62,
        24.34,
        24.46,
        24.4
       ],
       "acceptance": null,
       "mean_len": null
      },
      "speedup": 1.0
     },
     "mtp1": {
      "status": "ok",
      "vram_gib": 30.56,
      "prompts": {
       "code": {
        "n": 4,
        "min": 37.02,
        "median": 37.18,
        "max": 37.31,
        "mean": 37.17,
        "spread_pct": 0.8,
        "values": [
         37.02,
         37.18,
         37.18,
         37.31
        ],
        "acceptance": 78.3,
        "mean_len": 1.78,
        "pred_n": 256,
        "prompt_tps": 224.6,
        "speedup": 1.514
       },
       "prosa": {
        "n": 4,
        "min": 37.41,
        "median": 37.46,
        "max": 37.95,
        "mean": 37.57,
        "spread_pct": 1.4,
        "values": [
         37.41,
         37.41,
         37.51,
         37.95
        ],
        "acceptance": 80.1,
        "mean_len": 1.79,
        "pred_n": 256,
        "prompt_tps": 257.3,
        "speedup": 1.533
       },
       "reasoning": {
        "n": 4,
        "min": 39.29,
        "median": 39.86,
        "max": 40.2,
        "mean": 39.8,
        "spread_pct": 2.3,
        "values": [
         39.29,
         39.54,
         40.18,
         40.2
        ],
        "acceptance": 87.5,
        "mean_len": 1.87,
        "pred_n": 256,
        "prompt_tps": 338.9,
        "speedup": 1.632
       }
      },
      "overall": {
       "n": 12,
       "min": 37.02,
       "median": 37.46,
       "max": 40.2,
       "mean": 38.18,
       "spread_pct": 8.5,
       "values": [
        37.02,
        37.18,
        37.18,
        37.31,
        37.41,
        37.41,
        37.51,
        37.95,
        39.29,
        39.54,
        40.18,
        40.2
       ],
       "acceptance": 81.9,
       "mean_len": 1.81
      },
      "speedup": 1.531
     },
     "mtp2": {
      "status": "ok",
      "vram_gib": 30.7,
      "prompts": {
       "code": {
        "n": 4,
        "min": 39.76,
        "median": 41.44,
        "max": 41.55,
        "mean": 41.05,
        "spread_pct": 4.3,
        "values": [
         39.76,
         41.46,
         41.55,
         41.43
        ],
        "acceptance": 57.4,
        "mean_len": 2.13,
        "pred_n": 256,
        "prompt_tps": 252.1,
        "speedup": 1.688
       },
       "prosa": {
        "n": 4,
        "min": 46.07,
        "median": 46.23,
        "max": 46.28,
        "mean": 46.2,
        "spread_pct": 0.5,
        "values": [
         46.07,
         46.22,
         46.28,
         46.24
        ],
        "acceptance": 69.2,
        "mean_len": 2.37,
        "pred_n": 256,
        "prompt_tps": 261.8,
        "speedup": 1.892
       },
       "reasoning": {
        "n": 4,
        "min": 48.62,
        "median": 48.75,
        "max": 48.82,
        "mean": 48.74,
        "spread_pct": 0.4,
        "values": [
         48.82,
         48.76,
         48.62,
         48.74
        ],
        "acceptance": 76.6,
        "mean_len": 2.51,
        "pred_n": 256,
        "prompt_tps": 342.2,
        "speedup": 1.995
       }
      },
      "overall": {
       "n": 12,
       "min": 39.76,
       "median": 46.23,
       "max": 48.82,
       "mean": 45.33,
       "spread_pct": 19.6,
       "values": [
        39.76,
        41.46,
        41.55,
        41.43,
        46.07,
        46.22,
        46.28,
        46.24,
        48.82,
        48.76,
        48.62,
        48.74
       ],
       "acceptance": 67.2,
       "mean_len": 2.33
      },
      "speedup": 1.889
     },
     "mtp3": {
      "status": "ok",
      "vram_gib": 30.85,
      "prompts": {
       "code": {
        "n": 4,
        "min": 41.26,
        "median": 42.22,
        "max": 42.29,
        "mean": 42.0,
        "spread_pct": 2.4,
        "values": [
         41.26,
         42.21,
         42.24,
         42.29
        ],
        "acceptance": 48.9,
        "mean_len": 2.44,
        "pred_n": 256,
        "prompt_tps": 256.4,
        "speedup": 1.72
       },
       "prosa": {
        "n": 4,
        "min": 45.77,
        "median": 45.8,
        "max": 45.81,
        "mean": 45.8,
        "spread_pct": 0.1,
        "values": [
         45.81,
         45.77,
         45.81,
         45.79
        ],
        "acceptance": 55.6,
        "mean_len": 2.64,
        "pred_n": 256,
        "prompt_tps": 258.6,
        "speedup": 1.874
       },
       "reasoning": {
        "n": 4,
        "min": 51.97,
        "median": 52.05,
        "max": 52.11,
        "mean": 52.04,
        "spread_pct": 0.3,
        "values": [
         52.07,
         52.02,
         52.11,
         51.97
        ],
        "acceptance": 68.4,
        "mean_len": 3.01,
        "pred_n": 256,
        "prompt_tps": 339.7,
        "speedup": 2.131
       }
      },
      "overall": {
       "n": 12,
       "min": 41.26,
       "median": 45.8,
       "max": 52.11,
       "mean": 46.61,
       "spread_pct": 23.7,
       "values": [
        41.26,
        42.21,
        42.24,
        42.29,
        45.81,
        45.77,
        45.81,
        45.79,
        52.07,
        52.02,
        52.11,
        51.97
       ],
       "acceptance": 56.9,
       "mean_len": 2.68
      },
      "speedup": 1.872
     }
    },
    "vulkan-p2": {
     "baseline": {
      "status": "ok",
      "vram_gib": 28.51,
      "prompts": {
       "code": {
        "n": 4,
        "min": 25.07,
        "median": 25.24,
        "max": 25.26,
        "mean": 25.21,
        "spread_pct": 0.8,
        "values": [
         25.07,
         25.26,
         25.26,
         25.23
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 276.4,
        "speedup": 1.0
       },
       "prosa": {
        "n": 4,
        "min": 25.19,
        "median": 25.2,
        "max": 25.21,
        "mean": 25.2,
        "spread_pct": 0.1,
        "values": [
         25.21,
         25.2,
         25.2,
         25.19
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 275.4,
        "speedup": 1.0
       },
       "reasoning": {
        "n": 4,
        "min": 25.16,
        "median": 25.18,
        "max": 25.19,
        "mean": 25.18,
        "spread_pct": 0.1,
        "values": [
         25.19,
         25.18,
         25.16,
         25.18
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 358.3,
        "speedup": 1.0
       }
      },
      "overall": {
       "n": 12,
       "min": 25.07,
       "median": 25.2,
       "max": 25.26,
       "mean": 25.2,
       "spread_pct": 0.8,
       "values": [
        25.07,
        25.26,
        25.26,
        25.23,
        25.21,
        25.2,
        25.2,
        25.19,
        25.19,
        25.18,
        25.16,
        25.18
       ],
       "acceptance": null,
       "mean_len": null
      },
      "speedup": 1.0
     },
     "mtp1": {
      "status": "ok",
      "vram_gib": 30.77,
      "prompts": {
       "code": {
        "n": 4,
        "min": 38.2,
        "median": 38.28,
        "max": 38.3,
        "mean": 38.27,
        "spread_pct": 0.3,
        "values": [
         38.2,
         38.3,
         38.28,
         38.28
        ],
        "acceptance": 78.3,
        "mean_len": 1.78,
        "pred_n": 256,
        "prompt_tps": 258.6,
        "speedup": 1.517
       },
       "prosa": {
        "n": 4,
        "min": 38.46,
        "median": 38.49,
        "max": 38.53,
        "mean": 38.49,
        "spread_pct": 0.2,
        "values": [
         38.51,
         38.46,
         38.46,
         38.53
        ],
        "acceptance": 80.1,
        "mean_len": 1.79,
        "pred_n": 256,
        "prompt_tps": 261.1,
        "speedup": 1.527
       },
       "reasoning": {
        "n": 4,
        "min": 40.09,
        "median": 40.14,
        "max": 40.16,
        "mean": 40.13,
        "spread_pct": 0.2,
        "values": [
         40.14,
         40.09,
         40.14,
         40.16
        ],
        "acceptance": 87.5,
        "mean_len": 1.87,
        "pred_n": 256,
        "prompt_tps": 342.4,
        "speedup": 1.594
       }
      },
      "overall": {
       "n": 12,
       "min": 38.2,
       "median": 38.49,
       "max": 40.16,
       "mean": 38.96,
       "spread_pct": 5.1,
       "values": [
        38.2,
        38.3,
        38.28,
        38.28,
        38.51,
        38.46,
        38.46,
        38.53,
        40.14,
        40.09,
        40.14,
        40.16
       ],
       "acceptance": 81.9,
       "mean_len": 1.81
      },
      "speedup": 1.527
     },
     "mtp2": {
      "status": "ok",
      "vram_gib": 31.07,
      "prompts": {
       "code": {
        "n": 4,
        "min": 39.52,
        "median": 41.13,
        "max": 41.38,
        "mean": 40.79,
        "spread_pct": 4.5,
        "values": [
         40.91,
         41.35,
         41.38,
         39.52
        ],
        "acceptance": 57.4,
        "mean_len": 2.13,
        "pred_n": 256,
        "prompt_tps": 230.8,
        "speedup": 1.63
       },
       "prosa": {
        "n": 4,
        "min": 45.46,
        "median": 45.78,
        "max": 45.88,
        "mean": 45.72,
        "spread_pct": 0.9,
        "values": [
         45.46,
         45.78,
         45.88,
         45.77
        ],
        "acceptance": 69.2,
        "mean_len": 2.37,
        "pred_n": 256,
        "prompt_tps": 259.3,
        "speedup": 1.817
       },
       "reasoning": {
        "n": 4,
        "min": 48.29,
        "median": 48.35,
        "max": 48.45,
        "mean": 48.36,
        "spread_pct": 0.3,
        "values": [
         48.31,
         48.39,
         48.45,
         48.29
        ],
        "acceptance": 76.6,
        "mean_len": 2.51,
        "pred_n": 256,
        "prompt_tps": 341.2,
        "speedup": 1.92
       }
      },
      "overall": {
       "n": 12,
       "min": 39.52,
       "median": 45.78,
       "max": 48.45,
       "mean": 44.96,
       "spread_pct": 19.5,
       "values": [
        40.91,
        41.35,
        41.38,
        39.52,
        45.46,
        45.78,
        45.88,
        45.77,
        48.31,
        48.39,
        48.45,
        48.29
       ],
       "acceptance": 67.2,
       "mean_len": 2.33
      },
      "speedup": 1.817
     }
    },
    "vulkan-p3": {
     "baseline": {
      "status": "ok",
      "vram_gib": 28.71,
      "prompts": {
       "code": {
        "n": 4,
        "min": 25.13,
        "median": 25.19,
        "max": 25.21,
        "mean": 25.18,
        "spread_pct": 0.3,
        "values": [
         25.13,
         25.21,
         25.2,
         25.18
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 272.4,
        "speedup": 1.0
       },
       "prosa": {
        "n": 4,
        "min": 25.17,
        "median": 25.18,
        "max": 25.18,
        "mean": 25.18,
        "spread_pct": 0.0,
        "values": [
         25.18,
         25.17,
         25.18,
         25.18
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 274.5,
        "speedup": 1.0
       },
       "reasoning": {
        "n": 4,
        "min": 25.15,
        "median": 25.17,
        "max": 25.19,
        "mean": 25.17,
        "spread_pct": 0.1,
        "values": [
         25.17,
         25.15,
         25.17,
         25.19
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 358.8,
        "speedup": 1.0
       }
      },
      "overall": {
       "n": 12,
       "min": 25.13,
       "median": 25.18,
       "max": 25.21,
       "mean": 25.18,
       "spread_pct": 0.3,
       "values": [
        25.13,
        25.21,
        25.2,
        25.18,
        25.18,
        25.17,
        25.18,
        25.18,
        25.17,
        25.15,
        25.17,
        25.19
       ],
       "acceptance": null,
       "mean_len": null
      },
      "speedup": 1.0
     },
     "mtp1": {
      "status": "ok",
      "vram_gib": 31.15,
      "prompts": {
       "code": {
        "n": 4,
        "min": 37.95,
        "median": 38.13,
        "max": 38.3,
        "mean": 38.13,
        "spread_pct": 0.9,
        "values": [
         37.95,
         38.11,
         38.14,
         38.3
        ],
        "acceptance": 78.3,
        "mean_len": 1.78,
        "pred_n": 256,
        "prompt_tps": 259.6,
        "speedup": 1.514
       },
       "prosa": {
        "n": 4,
        "min": 38.5,
        "median": 38.51,
        "max": 38.53,
        "mean": 38.51,
        "spread_pct": 0.1,
        "values": [
         38.53,
         38.52,
         38.5,
         38.5
        ],
        "acceptance": 80.1,
        "mean_len": 1.79,
        "pred_n": 256,
        "prompt_tps": 260.4,
        "speedup": 1.529
       },
       "reasoning": {
        "n": 4,
        "min": 40.12,
        "median": 40.16,
        "max": 40.16,
        "mean": 40.15,
        "spread_pct": 0.1,
        "values": [
         40.16,
         40.12,
         40.16,
         40.16
        ],
        "acceptance": 87.5,
        "mean_len": 1.87,
        "pred_n": 256,
        "prompt_tps": 343.3,
        "speedup": 1.596
       }
      },
      "overall": {
       "n": 12,
       "min": 37.95,
       "median": 38.51,
       "max": 40.16,
       "mean": 38.93,
       "spread_pct": 5.7,
       "values": [
        37.95,
        38.11,
        38.14,
        38.3,
        38.53,
        38.52,
        38.5,
        38.5,
        40.16,
        40.12,
        40.16,
        40.16
       ],
       "acceptance": 81.9,
       "mean_len": 1.81
      },
      "speedup": 1.529
     },
     "mtp2": {
      "status": "ok",
      "vram_gib": 30.99,
      "prompts": {
       "code": {
        "n": 4,
        "min": 30.21,
        "median": 30.92,
        "max": 31.03,
        "mean": 30.77,
        "spread_pct": 2.7,
        "values": [
         30.21,
         30.89,
         31.03,
         30.96
        ],
        "acceptance": 57.1,
        "mean_len": 2.13,
        "pred_n": 256,
        "prompt_tps": 168.5,
        "speedup": 1.227
       },
       "prosa": {
        "n": 4,
        "min": 32.21,
        "median": 32.3,
        "max": 32.34,
        "mean": 32.29,
        "spread_pct": 0.4,
        "values": [
         32.21,
         32.34,
         32.32,
         32.29
        ],
        "acceptance": 62.1,
        "mean_len": 2.23,
        "pred_n": 256,
        "prompt_tps": 177.6,
        "speedup": 1.283
       },
       "reasoning": {
        "n": 4,
        "min": 36.57,
        "median": 36.78,
        "max": 36.89,
        "mean": 36.76,
        "spread_pct": 0.9,
        "values": [
         36.57,
         36.89,
         36.74,
         36.83
        ],
        "acceptance": 77.9,
        "mean_len": 2.53,
        "pred_n": 256,
        "prompt_tps": 224.3,
        "speedup": 1.461
       }
      },
      "overall": {
       "n": 12,
       "min": 30.21,
       "median": 32.3,
       "max": 36.89,
       "mean": 33.27,
       "spread_pct": 20.7,
       "values": [
        30.21,
        30.89,
        31.03,
        30.96,
        32.21,
        32.34,
        32.32,
        32.29,
        36.57,
        36.89,
        36.74,
        36.83
       ],
       "acceptance": 65.1,
       "mean_len": 2.29
      },
      "speedup": 1.283
     }
    }
   }
  },
  {
   "id": "2026-09-13-qwen38-mtp",
   "title": "MTP-Speculative-Decoding, Qwen3.8-Flash-Next",
   "date": "2026-09-13",
   "question": "Bringt der MTP-Draft-Head auf dieser Maschine Durchsatz, welches --spec-draft-n-max ist optimal, und wie schlaegt sich ROCm gegen Vulkan?",
   "machine": {
    "GPU": "AMD Radeon AI PRO R9700, gfx1201, 31,86 GiB VRAM",
    "CPU": "AMD Ryzen Threadripper PRO 3975WX, 32 Kerne",
    "RAM": "61 GiB, davon rund 58 nutzbar",
    "OS": "Ubuntu 26.04, Kernel 7.0",
    "ROCm": "System 7.2.4 (neuester von AMD angebotener Zweig)"
   },
   "model": {
    "Modell": "Qwen3.8-Flash-Next UD-Q2_K_XL (73,45 GiB, Architektur qwen4exp)",
    "Draft-Head": "mtp-Qwen3.8-Flash-Next-shared-Q8_0.gguf (2,6 GiB)",
    "Build": "Unsloth-Fork b10909-mix-bea84f7, 0.4.0-dev, commit 329b6160f"
   },
   "method": {
    "Kontext": "262144, cache-type-k/v q8_0",
    "Aufteilung": "--fit on, --parallel 1, --load-mode none",
    "Sampling": "greedy (temperature 0, top_k 1, seed 42), cache_prompt false",
    "Messung": "3 Prompt-Typen x 4 Wiederholungen je Konfiguration, 256 Tokens, ein Warmlauf vorab",
    "Kennzahl": "Median der Einzelwerte"
   },
   "cmdline": "llama-server --device $DEVICE --ctx-size 262144 --fit on --cache-type-k q8_0 --cache-type-v q8_0 --load-mode none --parallel 1 -m Qwen3.8-Flash-Next-UD-Q2_K_XL-00001-of-00003.gguf [-md MTP/mtp-...-shared-Q8_0.gguf --spec-type draft-mtp --spec-draft-n-max N]",
   "backends": {
    "vulkan": {
     "label": "Vulkan",
     "device": "Vulkan0",
     "detail": "Fork-Asset linux-x64-vulkan, Backend ~/llmstore/software/llama.cpp/vulkan-mtp/"
    },
    "rocm": {
     "label": "ROCm",
     "device": "ROCm0",
     "detail": "Fork-Asset linux-x64-rocm-gfx120X, mitgelieferte Libs HIP 7.16.26332 / rocBLAS 5.7 / hipBLASLt 1.4, also neuer als System-ROCm 7.2.4. Backend ~/llmstore/software/llama.cpp/rocm-mtp/"
    },
    "rocm-fit": {
     "label": "ROCm + Marge",
     "device": "ROCm0",
     "detail": "Wie ROCm, zusaetzlich --fit-target 3600. Die Marge haelt VRAM frei, damit der Draft-Head ueberhaupt geladen werden kann. Nur so laufen die MTP-Konfigurationen auf ROCm."
    }
   },
   "configs": {
    "baseline": {
     "label": "ohne MTP",
     "order": 0
    },
    "mtp1": {
     "label": "MTP n-max 1",
     "order": 1
    },
    "mtp2": {
     "label": "MTP n-max 2",
     "order": 2
    },
    "mtp3": {
     "label": "MTP n-max 3",
     "order": 3
    }
   },
   "prompts": {
    "code": "Python-Klasse fuer einen LRU-Cache mit Typannotationen und Komplexitaetsanalyse",
    "prosa": "Fliesstext zur Heizkostenabrechnung in einer WEG",
    "reasoning": "Einholvorgang zweier Zuege, Schritt fuer Schritt mit Gegenprobe"
   },
   "notes": [
    "Mainline b10930 kennt das Flag --spec-type draft-mtp generisch, enthaelt aber keinen llama_model_qwen4exp::graph_mtp und ignoriert den Head still. Nur der Unsloth-Fork hat die vtable.",
    "Der shared Draft-Head wirft beim Laden zwingend 'error loading model: ... draft head without its own token_embd.weight'. Das ist erwartet und harmlos, er bezieht Token-Embedding und Output-Projektion aus dem Hauptmodell.",
    "-md muss explizit gesetzt werden, die Auto-Discovery ueberspringt den Unterordner MTP/.",
    "--fit meldet in beiden Backends 'failed to measure the memory of the extra model, fitting without it' und rechnet den Draft-Head nicht ein. Auf Vulkan passte er zufaellig noch in den Rest, auf ROCm nicht: dort scheitern alle MTP-Konfigurationen an cudaMalloc out of memory fuer 2647 MiB. Abhilfe ist --fit-target, das eine Marge pro Geraet freihaelt.",
    "Bei Nebenlaeufigkeit ueber 1 kippt der Gewinn laut Upstream-Diskussion ins Negative (0,81x bis 0,87x). Diese Messung gilt fuer --parallel 1.",
    "Mit --fit-target 3600 laufen die MTP-Konfigurationen auch auf ROCm. Die Marge kostet die Baseline wenig (28,28 statt 30,95 GiB VRAM, rund 3 Prozent Durchsatz), die MTP-Laeufe fuellen sie mit dem Draft-Head wieder auf (31,3 bis 31,6 GiB).",
    "ROCm liegt in dieser Messreihe durchgehend hinter Vulkan, ohne MTP um rund ein Viertel. Auch mit MTP erreicht ROCm nicht die Vulkan-Baseline."
   ],
   "results": {
    "rocm": {
     "baseline": {
      "status": "ok",
      "vram_gib": 30.95,
      "prompts": {
       "code": {
        "n": 4,
        "min": 15.55,
        "median": 16.62,
        "max": 17.17,
        "mean": 16.49,
        "spread_pct": 9.8,
        "values": [
         16.32,
         17.17,
         16.93,
         15.55
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 120.1,
        "speedup": 1.0
       },
       "prosa": {
        "n": 4,
        "min": 15.13,
        "median": 15.47,
        "max": 16.18,
        "mean": 15.56,
        "spread_pct": 6.7,
        "values": [
         15.13,
         16.18,
         15.52,
         15.42
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 118.0,
        "speedup": 1.0
       },
       "reasoning": {
        "n": 4,
        "min": 15.24,
        "median": 15.51,
        "max": 15.59,
        "mean": 15.46,
        "spread_pct": 2.3,
        "values": [
         15.24,
         15.59,
         15.49,
         15.53
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 140.6,
        "speedup": 1.0
       }
      },
      "overall": {
       "n": 12,
       "min": 15.13,
       "median": 15.54,
       "max": 17.17,
       "mean": 15.84,
       "spread_pct": 13.1,
       "values": [
        16.32,
        17.17,
        16.93,
        15.55,
        15.13,
        16.18,
        15.52,
        15.42,
        15.24,
        15.59,
        15.49,
        15.53
       ],
       "acceptance": null,
       "mean_len": null
      },
      "speedup": 1.0
     },
     "mtp1": {
      "status": "failed",
      "error": "allocating 2647.04 MiB on device 0: cudaMalloc failed: out of memory",
      "vram_gib": null
     },
     "mtp2": {
      "status": "failed",
      "error": "allocating 2647.04 MiB on device 0: cudaMalloc failed: out of memory",
      "vram_gib": null
     },
     "mtp3": {
      "status": "failed",
      "error": "allocating 2647.04 MiB on device 0: cudaMalloc failed: out of memory",
      "vram_gib": null
     }
    },
    "rocm-fit": {
     "baseline": {
      "status": "ok",
      "vram_gib": 28.28,
      "prompts": {
       "code": {
        "n": 4,
        "min": 14.68,
        "median": 14.75,
        "max": 15.0,
        "mean": 14.8,
        "spread_pct": 2.1,
        "values": [
         14.75,
         15.0,
         14.75,
         14.68
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 100.7,
        "speedup": 1.0
       },
       "prosa": {
        "n": 4,
        "min": 14.53,
        "median": 15.0,
        "max": 15.56,
        "mean": 15.03,
        "spread_pct": 6.9,
        "values": [
         14.53,
         15.56,
         14.69,
         15.31
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 102.2,
        "speedup": 1.0
       },
       "reasoning": {
        "n": 4,
        "min": 15.26,
        "median": 15.42,
        "max": 15.59,
        "mean": 15.42,
        "spread_pct": 2.2,
        "values": [
         15.26,
         15.34,
         15.59,
         15.49
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 126.1,
        "speedup": 1.0
       }
      },
      "overall": {
       "n": 12,
       "min": 14.53,
       "median": 15.13,
       "max": 15.59,
       "mean": 15.08,
       "spread_pct": 7.0,
       "values": [
        14.75,
        15.0,
        14.75,
        14.68,
        14.53,
        15.56,
        14.69,
        15.31,
        15.26,
        15.34,
        15.59,
        15.49
       ],
       "acceptance": null,
       "mean_len": null
      },
      "speedup": 1.0
     },
     "mtp1": {
      "status": "ok",
      "vram_gib": 31.61,
      "prompts": {
       "code": {
        "n": 4,
        "min": 17.29,
        "median": 17.98,
        "max": 19.0,
        "mean": 18.06,
        "spread_pct": 9.5,
        "values": [
         17.29,
         19.0,
         18.29,
         17.66
        ],
        "acceptance": 77.9,
        "mean_len": 1.77,
        "pred_n": 256,
        "prompt_tps": 99.6,
        "speedup": 1.219
       },
       "prosa": {
        "n": 4,
        "min": 17.61,
        "median": 19.1,
        "max": 19.94,
        "mean": 18.94,
        "spread_pct": 12.2,
        "values": [
         17.61,
         19.94,
         19.35,
         18.85
        ],
        "acceptance": 76.4,
        "mean_len": 1.75,
        "pred_n": 256,
        "prompt_tps": 98.8,
        "speedup": 1.273
       },
       "reasoning": {
        "n": 4,
        "min": 18.48,
        "median": 19.25,
        "max": 19.65,
        "mean": 19.16,
        "spread_pct": 6.1,
        "values": [
         18.48,
         19.57,
         19.65,
         18.93
        ],
        "acceptance": 84.8,
        "mean_len": 1.84,
        "pred_n": 256,
        "prompt_tps": 120.6,
        "speedup": 1.248
       }
      },
      "overall": {
       "n": 12,
       "min": 17.29,
       "median": 18.89,
       "max": 19.94,
       "mean": 18.72,
       "spread_pct": 14.0,
       "values": [
        17.29,
        19.0,
        18.29,
        17.66,
        17.61,
        19.94,
        19.35,
        18.85,
        18.48,
        19.57,
        19.65,
        18.93
       ],
       "acceptance": 79.6,
       "mean_len": 1.79
      },
      "speedup": 1.249
     },
     "mtp2": {
      "status": "ok",
      "vram_gib": 31.29,
      "prompts": {
       "code": {
        "n": 4,
        "min": 18.28,
        "median": 18.76,
        "max": 19.67,
        "mean": 18.87,
        "spread_pct": 7.4,
        "values": [
         18.28,
         18.65,
         18.87,
         19.67
        ],
        "acceptance": 71.8,
        "mean_len": 2.42,
        "pred_n": 256,
        "prompt_tps": 105.7,
        "speedup": 1.272
       },
       "prosa": {
        "n": 4,
        "min": 15.28,
        "median": 15.65,
        "max": 17.41,
        "mean": 16.0,
        "spread_pct": 13.6,
        "values": [
         15.28,
         15.56,
         15.73,
         17.41
        ],
        "acceptance": 51.0,
        "mean_len": 2.0,
        "pred_n": 256,
        "prompt_tps": 105.5,
        "speedup": 1.043
       },
       "reasoning": {
        "n": 4,
        "min": 18.72,
        "median": 18.86,
        "max": 20.43,
        "mean": 19.22,
        "spread_pct": 9.1,
        "values": [
         20.43,
         18.72,
         18.85,
         18.88
        ],
        "acceptance": 74.3,
        "mean_len": 2.45,
        "pred_n": 256,
        "prompt_tps": 136.7,
        "speedup": 1.223
       }
      },
      "overall": {
       "n": 12,
       "min": 15.28,
       "median": 18.68,
       "max": 20.43,
       "mean": 18.03,
       "spread_pct": 27.6,
       "values": [
        18.28,
        18.65,
        18.87,
        19.67,
        15.28,
        15.56,
        15.73,
        17.41,
        20.43,
        18.72,
        18.85,
        18.88
       ],
       "acceptance": 64.7,
       "mean_len": 2.27
      },
      "speedup": 1.235
     },
     "mtp3": {
      "status": "ok",
      "vram_gib": 31.4,
      "prompts": {
       "code": {
        "n": 4,
        "min": 17.68,
        "median": 18.4,
        "max": 19.67,
        "mean": 18.54,
        "spread_pct": 10.8,
        "values": [
         17.68,
         19.67,
         18.25,
         18.55
        ],
        "acceptance": 60.2,
        "mean_len": 2.78,
        "pred_n": 256,
        "prompt_tps": 106.7,
        "speedup": 1.247
       },
       "prosa": {
        "n": 4,
        "min": 13.73,
        "median": 14.23,
        "max": 14.9,
        "mean": 14.28,
        "spread_pct": 8.2,
        "values": [
         13.73,
         14.11,
         14.9,
         14.36
        ],
        "acceptance": 41.9,
        "mean_len": 2.25,
        "pred_n": 256,
        "prompt_tps": 104.0,
        "speedup": 0.949
       },
       "reasoning": {
        "n": 4,
        "min": 17.46,
        "median": 18.15,
        "max": 19.0,
        "mean": 18.19,
        "spread_pct": 8.5,
        "values": [
         17.46,
         17.84,
         19.0,
         18.47
        ],
        "acceptance": 62.3,
        "mean_len": 2.81,
        "pred_n": 256,
        "prompt_tps": 138.0,
        "speedup": 1.177
       }
      },
      "overall": {
       "n": 12,
       "min": 13.73,
       "median": 17.76,
       "max": 19.67,
       "mean": 17.0,
       "spread_pct": 33.4,
       "values": [
        17.68,
        19.67,
        18.25,
        18.55,
        13.73,
        14.11,
        14.9,
        14.36,
        17.46,
        17.84,
        19.0,
        18.47
       ],
       "acceptance": 53.8,
       "mean_len": 2.59
      },
      "speedup": 1.174
     }
    },
    "vulkan": {
     "baseline": {
      "status": "ok",
      "vram_gib": 30.7,
      "prompts": {
       "code": {
        "n": 4,
        "min": 18.8,
        "median": 19.91,
        "max": 22.19,
        "mean": 20.2,
        "spread_pct": 17.1,
        "values": [
         22.19,
         18.8,
         19.18,
         20.63
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 112.9,
        "speedup": 1.0
       },
       "prosa": {
        "n": 4,
        "min": 17.75,
        "median": 23.05,
        "max": 23.36,
        "mean": 21.8,
        "spread_pct": 24.4,
        "values": [
         22.74,
         17.75,
         23.36,
         23.36
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 113.2,
        "speedup": 1.0
       },
       "reasoning": {
        "n": 4,
        "min": 17.66,
        "median": 20.97,
        "max": 22.65,
        "mean": 20.56,
        "spread_pct": 23.8,
        "values": [
         22.65,
         17.66,
         20.06,
         21.88
        ],
        "acceptance": null,
        "mean_len": null,
        "pred_n": 256,
        "prompt_tps": 140.9,
        "speedup": 1.0
       }
      },
      "overall": {
       "n": 12,
       "min": 17.66,
       "median": 21.26,
       "max": 23.36,
       "mean": 20.86,
       "spread_pct": 26.8,
       "values": [
        22.19,
        18.8,
        19.18,
        20.63,
        22.74,
        17.75,
        23.36,
        23.36,
        22.65,
        17.66,
        20.06,
        21.88
       ],
       "acceptance": null,
       "mean_len": null
      },
      "speedup": 1.0
     },
     "mtp1": {
      "status": "ok",
      "vram_gib": 31.48,
      "prompts": {
       "code": {
        "n": 4,
        "min": 25.58,
        "median": 29.34,
        "max": 30.4,
        "mean": 28.66,
        "spread_pct": 16.4,
        "values": [
         28.43,
         30.4,
         30.26,
         25.58
        ],
        "acceptance": 81.2,
        "mean_len": 1.81,
        "pred_n": 256,
        "prompt_tps": 111.0,
        "speedup": 1.474
       },
       "prosa": {
        "n": 4,
        "min": 26.18,
        "median": 27.76,
        "max": 28.06,
        "mean": 27.44,
        "spread_pct": 6.8,
        "values": [
         26.18,
         28.06,
         27.73,
         27.79
        ],
        "acceptance": 64.9,
        "mean_len": 1.64,
        "pred_n": 256,
        "prompt_tps": 110.3,
        "speedup": 1.204
       },
       "reasoning": {
        "n": 4,
        "min": 24.78,
        "median": 25.82,
        "max": 30.97,
        "mean": 26.85,
        "spread_pct": 24.0,
        "values": [
         30.97,
         26.73,
         24.78,
         24.91
        ],
        "acceptance": 94.7,
        "mean_len": 1.94,
        "pred_n": 256,
        "prompt_tps": 135.1,
        "speedup": 1.231
       }
      },
      "overall": {
       "n": 12,
       "min": 24.78,
       "median": 27.76,
       "max": 30.97,
       "mean": 27.65,
       "spread_pct": 22.3,
       "values": [
        28.43,
        30.4,
        30.26,
        25.58,
        26.18,
        28.06,
        27.73,
        27.79,
        30.97,
        26.73,
        24.78,
        24.91
       ],
       "acceptance": 79.4,
       "mean_len": 1.79
      },
      "speedup": 1.306
     },
     "mtp2": {
      "status": "ok",
      "vram_gib": 31.31,
      "prompts": {
       "code": {
        "n": 4,
        "min": 28.95,
        "median": 31.43,
        "max": 32.54,
        "mean": 31.09,
        "spread_pct": 11.4,
        "values": [
         31.48,
         28.95,
         31.38,
         32.54
        ],
        "acceptance": 67.6,
        "mean_len": 2.33,
        "pred_n": 256,
        "prompt_tps": 107.5,
        "speedup": 1.579
       },
       "prosa": {
        "n": 4,
        "min": 25.84,
        "median": 29.44,
        "max": 30.71,
        "mean": 28.86,
        "spread_pct": 16.5,
        "values": [
         28.95,
         30.71,
         29.93,
         25.84
        ],
        "acceptance": 60.2,
        "mean_len": 2.18,
        "pred_n": 256,
        "prompt_tps": 110.8,
        "speedup": 1.277
       },
       "reasoning": {
        "n": 4,
        "min": 31.95,
        "median": 34.44,
        "max": 37.44,
        "mean": 34.57,
        "spread_pct": 15.9,
        "values": [
         36.64,
         32.24,
         37.44,
         31.95
        ],
        "acceptance": 85.6,
        "mean_len": 2.67,
        "pred_n": 256,
        "prompt_tps": 135.3,
        "speedup": 1.642
       }
      },
      "overall": {
       "n": 12,
       "min": 25.84,
       "median": 31.43,
       "max": 37.44,
       "mean": 31.51,
       "spread_pct": 36.9,
       "values": [
        31.48,
        28.95,
        31.38,
        32.54,
        28.95,
        30.71,
        29.93,
        25.84,
        36.64,
        32.24,
        37.44,
        31.95
       ],
       "acceptance": 70.2,
       "mean_len": 2.38
      },
      "speedup": 1.478
     },
     "mtp3": {
      "status": "ok",
      "vram_gib": 31.82,
      "prompts": {
       "code": {
        "n": 4,
        "min": 26.22,
        "median": 28.62,
        "max": 30.4,
        "mean": 28.46,
        "spread_pct": 14.6,
        "values": [
         29.9,
         27.34,
         30.4,
         26.22
        ],
        "acceptance": 54.0,
        "mean_len": 2.59,
        "pred_n": 256,
        "prompt_tps": 95.3,
        "speedup": 1.437
       },
       "prosa": {
        "n": 4,
        "min": 25.12,
        "median": 26.4,
        "max": 27.78,
        "mean": 26.42,
        "spread_pct": 10.1,
        "values": [
         27.51,
         25.12,
         27.78,
         25.3
        ],
        "acceptance": 45.1,
        "mean_len": 2.33,
        "pred_n": 256,
        "prompt_tps": 96.2,
        "speedup": 1.145
       },
       "reasoning": {
        "n": 4,
        "min": 34.05,
        "median": 37.0,
        "max": 40.91,
        "mean": 37.24,
        "spread_pct": 18.5,
        "values": [
         40.91,
         36.13,
         34.05,
         37.86
        ],
        "acceptance": 86.4,
        "mean_len": 3.56,
        "pred_n": 256,
        "prompt_tps": 120.8,
        "speedup": 1.764
       }
      },
      "overall": {
       "n": 12,
       "min": 25.12,
       "median": 28.84,
       "max": 40.91,
       "mean": 30.71,
       "spread_pct": 54.8,
       "values": [
        29.9,
        27.34,
        30.4,
        26.22,
        27.51,
        25.12,
        27.78,
        25.3,
        40.91,
        36.13,
        34.05,
        37.86
       ],
       "acceptance": 58.8,
       "mean_len": 2.73
      },
      "speedup": 1.357
     }
    }
   }
  }
 ]
};
