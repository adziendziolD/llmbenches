import json, os, sys, threading, time, urllib.request, glob

KEY = next(l.split("=", 1)[1].strip() for l in open("/home/alex/git/llm-router/.env") if l.startswith("ROUTER_API_KEY="))
URL = "http://127.0.0.1:8888/v1/chat/completions"
MODEL = sys.argv[1]
CAPS = sorted(glob.glob("/sys/class/drm/card[0-9]*/device/hwmon/hwmon*/power1_average"))

samples = []
stop = threading.Event()

def sampler():
    while not stop.is_set():
        samples.append([int(open(p).read()) / 1e6 for p in CAPS])
        time.sleep(0.25)

def run(prompt, max_tokens):
    body = {"model": MODEL, "stream": True, "max_tokens": max_tokens, "temperature": 0.7,
            "stream_options": {"include_usage": True},
            "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request(URL, json.dumps(body).encode(),
                                 {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    t0 = time.time(); first = None; n = 0; usage = None; timings = None
    with urllib.request.urlopen(req, timeout=900) as r:
        for line in r:
            line = line.strip()
            if not line.startswith(b"data:") or line[5:].strip() == b"[DONE]":
                continue
            ev = json.loads(line[5:])
            for ch in ev.get("choices") or []:
                d = ch.get("delta") or {}
                if d.get("content") or d.get("reasoning_content") or d.get("reasoning"):
                    n += 1
                    first = first or time.time()
            usage = ev.get("usage") or usage
            timings = ev.get("timings") or timings
    t1 = time.time()
    ct = (usage or {}).get("completion_tokens") or n
    pt = (usage or {}).get("prompt_tokens")
    return {"prompt_tokens": pt, "completion_tokens": ct, "ttft": first - t0 if first else None,
            "gen_tps": ct / (t1 - first) if first and t1 > first else None, "total": t1 - t0, "timings": timings}

def fmt(r):
    s = f"prompt={r['prompt_tokens']} out={r['completion_tokens']} ttft={r['ttft']:.2f}s gen={r['gen_tps']:.1f} tok/s total={r['total']:.1f}s"
    t = r["timings"]
    if t:
        s += f" | server: prefill={t.get('prompt_per_second', 0):.0f} tok/s gen={t.get('predicted_per_second', 0):.1f} tok/s"
    return s

print("Warmup / Modellwechsel ...", flush=True)
t = time.time(); run("Sag hallo.", 8); print(f"  {time.time()-t:.1f}s", flush=True)

threading.Thread(target=sampler, daemon=True).start()
short = "Erklaere in etwa 400 Woertern, wie ein Transformer-Sprachmodell funktioniert."
for i in range(3):
    print("kurz", i + 1, fmt(run(short, 600)), flush=True)
long_prompt = ("Hier ist ein langer Text:\n" + ("Die Hausverwaltung erstellt jedes Jahr eine Abrechnung der Betriebskosten "
               "fuer alle Mieter, prueft Belege und verteilt Kosten nach Umlageschluessel. ") * 220
               + "\nFasse den Text in drei Saetzen zusammen.")
for i in range(2):
    print("lang", i + 1, fmt(run(long_prompt, 200)), flush=True)
stop.set()
if samples:
    for gi in range(len(CAPS)):
        vals = [s[gi] for s in samples]
        print(f"GPU{gi} Leistung: max {max(vals):.0f} W, Mittel {sum(vals)/len(vals):.0f} W")
