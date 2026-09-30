#!/usr/bin/env python3
"""Coding-Modell und Agenten-Modell im selben Router, einzeln gegen gleichzeitig.

Voraussetzung: llama-launcher start server-multi (--models-max 2), beide Modelle
geladen. Schreibt einzeln/ und gleichzeitig/ mit je coder.json und agent.json.
Key: $LLAMA_API_KEY oder ~/.config/llama-launcher/api-key.
"""
import json, os, sys, threading, urllib.request

BASE = "http://127.0.0.1:8898"
KEY = os.environ.get("LLAMA_API_KEY") or open(os.path.expanduser("~/.config/llama-launcher/api-key")).read().strip()
MODELS = {"coder": "qwen3.8-27b-code", "agent": "ornstein-hermes-27b"}
PROMPTS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "prompts.json")))
REPS, NPRED = 4, 256

def vram():
    return [round(int(open(f"/sys/class/drm/card{c}/device/mem_info_vram_used").read()) / 2**30, 2) for c in (0, 1)]

def ask(model, text):
    body = {"model": model, "messages": [{"role": "user", "content": text}], "max_tokens": NPRED,
            "temperature": 0, "top_k": 1, "seed": 42, "cache_prompt": False,
            "chat_template_kwargs": {"enable_thinking": False}}
    req = urllib.request.Request(BASE + "/v1/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    t = json.loads(urllib.request.urlopen(req, timeout=900).read())["timings"]
    return {"pred_n": t.get("predicted_n"), "tps": t.get("predicted_per_second"),
            "prompt_n": t.get("prompt_n"), "prompt_tps": t.get("prompt_per_second"),
            "draft_n": t.get("draft_n"), "draft_accepted": t.get("draft_n_accepted")}

for name, m in MODELS.items():       # Warmlauf, stellt auch sicher, dass beide geladen sind
    ask(m, "Sag kurz hallo.")
print("VRAM nach Warmlauf (GiB, card0 card1):", vram(), flush=True)

rows = {(mode, n): [] for mode in ("einzeln", "gleichzeitig") for n in MODELS}
for p in PROMPTS:
    for rep in range(1, REPS + 1):
        for n, m in MODELS.items():                       # einzeln, nacheinander
            rows[("einzeln", n)].append({"cfg": n, "prompt": p["id"], "rep": rep, **ask(m, p["text"])})
        out = {}
        def go(n, m):
            out[n] = ask(m, p["text"])
        th = [threading.Thread(target=go, args=(n, m)) for n, m in MODELS.items()]
        [t.start() for t in th]; [t.join() for t in th]    # gleichzeitig, zwei Anfragen auf einmal
        for n in MODELS:
            rows[("gleichzeitig", n)].append({"cfg": n, "prompt": p["id"], "rep": rep, **out[n]})
        print(f"  {p['id']} rep{rep}: einzeln coder {rows[('einzeln','coder')][-1]['tps']:.1f} agent {rows[('einzeln','agent')][-1]['tps']:.1f} | "
              f"gleichzeitig coder {out['coder']['tps']:.1f} agent {out['agent']['tps']:.1f}", flush=True)

for (mode, n), r in rows.items():
    os.makedirs(mode, exist_ok=True)
    json.dump(r, open(f"{mode}/{n}.json", "w"), indent=2)
print("VRAM am Ende (GiB, card0 card1):", vram())
print("### fertig")
