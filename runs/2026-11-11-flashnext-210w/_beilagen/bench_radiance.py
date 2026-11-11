#!/usr/bin/env python3
"""Messung gegen einen laufenden Radiance-Server, gleiche Methodik wie llmbenches
(3 Prompts x 4 Wiederholungen, 256 Tokens, greedy, ein Warmlauf).

Aufruf: bench_radiance.py PORT MODELL CFG OUTDIR [PROMPTS_JSON] [KEY]
Schreibt OUTDIR/CFG.json im llmbenches-Format (cfg, prompt, rep, pred_n, tps, prompt_tps, ...).
tps = Decode-Rate ab dem ersten Token, prompt_tps = Prompt-Tokens / Zeit bis zum ersten Token.
"""
import json, sys, time, urllib.request

port, model, cfg, out = sys.argv[1:5]
prompts_file = sys.argv[5] if len(sys.argv) > 5 else \
    "/home/alex/git/llmbenches/runs/2026-09-30-qwen38-27b-q8-vs-q6/prompts.json"
key = sys.argv[6] if len(sys.argv) > 6 else ""
NPRED, REPS = 256, 4
prompts = json.load(open(prompts_file))


def one(text):
    body = {"model": model, "messages": [{"role": "user", "content": text}],
            "max_tokens": NPRED, "temperature": 0, "top_k": 1, "seed": 42, "stream": True,
            "stream_options": {"include_usage": True}}
    req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions",
                                 json.dumps(body).encode(),
                                 {"Content-Type": "application/json",
                                  **({"Authorization": f"Bearer {key}"} if key else {})})
    t0 = time.time(); first = None; last = t0; usage = {}
    with urllib.request.urlopen(req, timeout=900) as r:
        for line in r:
            line = line.decode().strip()
            if not line.startswith("data:") or line.endswith("[DONE]"):
                continue
            ev = json.loads(line[5:])
            if ev.get("usage"):
                usage = ev["usage"]
            ch = ev.get("choices") or []
            if ch and (ch[0].get("delta") or {}).get("content") or \
               ch and (ch[0].get("delta") or {}).get("reasoning_content"):
                now = time.time()
                if first is None:
                    first = now
                last = now
    n = usage.get("completion_tokens", 0)
    pn = usage.get("prompt_tokens", 0)
    dec = max(last - (first or last), 1e-6)
    return {"pred_n": n, "pred_ms": dec * 1000, "tps": (n - 1) / dec if n > 1 else 0.0,
            "prompt_n": pn, "prompt_tps": pn / (first - t0) if first else 0.0,
            "ttft_ms": ((first or t0) - t0) * 1000}


one(prompts[0]["text"])  # Warmlauf
rows = []
for p in prompts:
    for rep in range(1, REPS + 1):
        r = one(p["text"])
        rows.append({"cfg": cfg, "prompt": p["id"], "rep": rep, "draft_n": None,
                     "draft_accepted": None, **r})
        print(p["id"], rep, round(r["tps"], 2), "t/s", round(r["prompt_tps"], 1), "pp", flush=True)
import os
os.makedirs(out, exist_ok=True)
json.dump(rows, open(f"{out}/{cfg}.json", "w"), indent=1)
import statistics
print("Median tps:", round(statistics.median(x["tps"] for x in rows), 2))
