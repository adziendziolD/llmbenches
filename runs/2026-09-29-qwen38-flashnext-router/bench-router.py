#!/usr/bin/env python3
"""Misst ueber den Router (Port 8898) wie mtp-bench.sh: 3 Prompts x 4 Wiederholungen, greedy, 256 Tokens.
Key aus ~/.config/llama-launcher/api-key, wird nie ausgegeben. Zeichnet MemAvailable und VRAM mit."""
import json, os, sys, time, threading, urllib.request
model, out, cfg = sys.argv[1], sys.argv[2], sys.argv[3]
port = os.environ.get("PORT", "8898")
key = open(os.path.expanduser("~/.config/llama-launcher/api-key")).read().strip()
base = f"http://127.0.0.1:{port}"
here = os.path.dirname(os.path.abspath(__file__))
prompts = json.load(open(os.path.join(here, "prompts.json")))
def post(path, payload, timeout=1800):
    payload = dict(payload, model=model)
    req = urllib.request.Request(base + path, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())
mem = {"min_avail_gib": 1e9, "max_vram_gib": 0, "max_gtt_gib": 0}
stop = False
def watch():
    while not stop:
        try:
            for l in open("/proc/meminfo"):
                if l.startswith("MemAvailable"):
                    mem["min_avail_gib"] = min(mem["min_avail_gib"], int(l.split()[1]) / 1048576)
            d = "/sys/class/drm/card0/device/"
            mem["max_vram_gib"] = max(mem["max_vram_gib"], int(open(d + "mem_info_vram_used").read()) / 2**30)
            mem["max_gtt_gib"] = max(mem["max_gtt_gib"], int(open(d + "mem_info_gtt_used").read()) / 2**30)
        except Exception: pass
        time.sleep(2)
threading.Thread(target=watch, daemon=True).start()
def templated(text):
    try: return post("/apply-template", {"messages": [{"role": "user", "content": text}]})["prompt"]
    except Exception as e:
        print("apply-template fehlgeschlagen:", e, flush=True); return text
def run(prompt, n):
    return post("/completion", {"prompt": prompt, "n_predict": n, "temperature": 0.0,
                                "top_k": 1, "seed": 42, "cache_prompt": False})
t0 = time.time(); run(templated("Sag kurz hallo."), 16)
print(f"Ladezeit inkl. Warmlauf: {time.time()-t0:.0f} s", flush=True)
rows = []
for p in prompts:
    tp = templated(p["text"])
    for rep in (1, 2, 3, 4):
        r = run(tp, 256); t = r.get("timings", {})
        rows.append({"cfg": cfg, "prompt": p["id"], "rep": rep, "pred_n": t.get("predicted_n"),
            "pred_ms": t.get("predicted_ms"), "tps": t.get("predicted_per_second"),
            "prompt_n": t.get("prompt_n"), "prompt_tps": t.get("prompt_per_second"),
            "draft_n": t.get("draft_n"), "draft_accepted": t.get("draft_n_accepted"), "timings_raw": t})
        print(f"  {cfg} {p['id']} rep{rep}: {t.get('predicted_per_second'):.2f} t/s", flush=True)
stop = True
json.dump(rows, open(f"{out}/{cfg}.json", "w"), indent=2)
json.dump(mem, open(f"{out}/{cfg}.mem.json", "w"), indent=2)
print("mem:", json.dumps({k: round(v, 2) for k, v in mem.items()}))
