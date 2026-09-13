// erzeugt von tools/collect.py, nicht von Hand aendern
window.BENCH_DATA = {
 "generated": "2026-09-13T21:12:36+02:00",
 "runs": [
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
