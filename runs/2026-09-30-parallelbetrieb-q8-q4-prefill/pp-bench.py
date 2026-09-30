#!/usr/bin/env python3
"""Coding-Modell (Q8_0) und Agenten-Modell (Q4_K_M) im selben Router, Prompt-Processing und Generierung.

Coder bekommt einen Prompt von rund 3k Token, der Agent einen von rund 12k. Je Bedingung
(einzeln, gleichzeitig) REPS Wiederholungen. Ein kurzer Warmlauf je Modell stellt sicher, dass
beide geladen sind. Die Prompts werden ueber die Zeichenzahl auf die Zielgroesse gebracht,
die tatsaechliche Laenge steht in prompt_n.
Key: $LLAMA_API_KEY oder ~/.config/llama-launcher/api-key.
"""
import json, os, sys, threading, urllib.request

BASE = "http://127.0.0.1:8898"
KEY = os.environ.get("LLAMA_API_KEY") or open(os.path.expanduser("~/.config/llama-launcher/api-key")).read().strip()
MODELS = {"coder": "qwen3.8-27b-code", "agent": "ornstein-hermes-27b"}
TARGET = {"coder": 3000, "agent": 12000}
REPS, NPRED = int(os.environ.get("REPS", "2")), 256

def vram():
    return [round(int(open(f"/sys/class/drm/card{c}/device/mem_info_vram_used").read()) / 2**30, 2) for c in (0, 1)]

def call(model, text, n):
    body = {"model": model, "messages": [{"role": "user", "content": text}], "max_tokens": n,
            "temperature": 0, "top_k": 1, "seed": 42, "cache_prompt": False,
            "chat_template_kwargs": {"enable_thinking": False}}
    req = urllib.request.Request(BASE + "/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    t = json.loads(urllib.request.urlopen(req, timeout=1800).read())["timings"]
    return {"prompt_n": t.get("prompt_n"), "prompt_ms": t.get("prompt_ms"), "prompt_tps": t.get("prompt_per_second"),
            "pred_n": t.get("predicted_n"), "tps": t.get("predicted_per_second"),
            "draft_n": t.get("draft_n"), "draft_accepted": t.get("draft_n_accepted")}

CODE_BLOCKS = [
 "def parse_row_{i}(line: str, sep: str = ';') -> dict[str, float]:\n    \"\"\"Zerlegt eine CSV-Zeile {i} in Spalten und wandelt Betraege um.\"\"\"\n    parts = [p.strip() for p in line.split(sep)]\n    result: dict[str, float] = {{}}\n    for idx, part in enumerate(parts):\n        try:\n            result[f'col{{idx}}'] = float(part.replace(',', '.')) * {i}\n        except ValueError:\n            result[f'col{{idx}}'] = 0.0\n    return result\n",
 "class Ledger{i}:\n    def __init__(self, unit_id: int = {i}) -> None:\n        self.unit_id = unit_id\n        self.entries: list[tuple[str, float]] = []\n\n    def add(self, label: str, amount: float) -> None:\n        if amount < 0 and label.startswith('rueck'):\n            raise ValueError('Negative Rueckzahlung nicht erlaubt')\n        self.entries.append((label, amount))\n\n    def total(self) -> float:\n        return sum(a for _, a in self.entries) + {i}\n",
]
PROSE = [
 "Abschnitt {i}: Die Eigentuemergemeinschaft {i} verwaltet {u} Einheiten mit insgesamt {m} Quadratmetern Wohnflaeche. Die Heizkosten von {k} Euro werden zu {v} Prozent nach Verbrauch und zu {f} Prozent nach Wohnflaeche verteilt. Die Abrechnungsperiode endet am 31. Dezember, die Vorlage beim Verwalter ist bis zum {d}. Tag des Folgemonats vorgesehen. Rueckfragen einzelner Eigentuemer werden schriftlich beantwortet.",
 "Abschnitt {i}: Fuer das Objekt mit {u} Wohnungen wurde eine Instandhaltungsruecklage von {k} Euro gebildet. Der Beirat schlaegt vor, davon {m} Euro fuer die Sanierung des Daches zu verwenden. Die Eigentuemerversammlung beschliesst mit einfacher Mehrheit, sofern mindestens {v} Prozent der Miteigentumsanteile vertreten sind. Bei Widerspruch von mehr als {f} Prozent wird die Entscheidung nach {d} Tagen neu angesetzt.",
]
def block(kind, i):
    if kind == "coder":
        return CODE_BLOCKS[i % 2].format(i=i)
    return PROSE[i % 2].format(i=i, u=6+i*3%40, m=300+i*37%900, k=1000+i*853%9000, v=40+i*7%50, f=10+i*11%40, d=5+i*3%25)
TAIL = {"coder": "\n\nPruefe den obigen Python-Code auf Fehler, nenne die drei wichtigsten Probleme und schlage je eine konkrete Verbesserung vor.",
        "agent": "\n\nFasse die obigen Abschnitte in zehn Stichpunkten zusammen und nenne zu jedem Stichpunkt die wichtigste Zahl."}
def make(kind, n_blocks):
    return "".join(block(kind, i) + "\n" for i in range(1, n_blocks + 1)) + TAIL[kind]

# Kalibrierung: Token je Block aus einem kleinen Probelauf (zugleich Warmlauf), dann auf das Ziel skalieren
prompts = {}
for kind, model in MODELS.items():
    probe = 20
    r = call(model, make(kind, probe), 8)
    per_block = (r["prompt_n"] - 40) / probe
    blocks = max(1, round((TARGET[kind] - 40) / per_block))
    prompts[kind] = make(kind, blocks)
    print(f"Warmlauf {kind}: {per_block:.1f} Token je Block, {blocks} Bloecke fuer Ziel {TARGET[kind]}", flush=True)
print("VRAM nach Warmlauf (GiB, card0 card1):", vram(), flush=True)

rows = {(m, n): [] for m in ("einzeln", "gleichzeitig") for n in MODELS}
for rep in range(1, REPS + 1):
    for n, m in MODELS.items():
        rows[("einzeln", n)].append({"cfg": n, "prompt": "lang", "rep": rep, **call(m, prompts[n], NPRED)})
    out = {}
    def go(n, m):
        out[n] = call(m, prompts[n], NPRED)
    th = [threading.Thread(target=go, args=(n, m)) for n, m in MODELS.items()]
    [t.start() for t in th]; [t.join() for t in th]
    for n in MODELS:
        rows[("gleichzeitig", n)].append({"cfg": n, "prompt": "lang", "rep": rep, **out[n]})
    for mode in ("einzeln", "gleichzeitig"):
        c, a = rows[(mode, "coder")][-1], rows[(mode, "agent")][-1]
        print(f"  rep{rep} {mode:12s} coder pp {c['prompt_tps']:.0f} t/s ({c['prompt_n']} tok) gen {c['tps']:.1f} | "
              f"agent pp {a['prompt_tps']:.0f} t/s ({a['prompt_n']} tok) gen {a['tps']:.1f}", flush=True)

for (mode, n), r in rows.items():
    os.makedirs(mode, exist_ok=True)
    json.dump(r, open(f"{mode}/{n}.json", "w"), indent=2)
print("VRAM am Ende (GiB, card0 card1):", vram())
print("### fertig")
