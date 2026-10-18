#!/usr/bin/env python3
"""H3-T2V ueber Radiance /v1/videos: native (50 Gitterpunkte), up12, up20 (latent_upscale 2)."""
import json, sys, time, urllib.request

URL = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith("http") else "http://127.0.0.1:8960"
KINDS = [a for a in sys.argv[1:] if not a.startswith("http")] or ["warmup", "native", "up12", "up20"]
BASE = {"prompt": "A red fox trotting through a snowy pine forest, snow crunching underfoot",
        "seconds": "5", "size": "1344x768", "seed": 7}
CFG = {"warmup": {"size": "672x384", "num_inference_steps": 3},
       "native": {}, "up12": {"latent_upscale": 2, "upscale_refine_steps": 12},
       "up20": {"latent_upscale": 2, "upscale_refine_steps": 20}}

def req(path, data=None, raw=False):
    r = urllib.request.Request(URL + path, data=json.dumps(data).encode() if data is not None else None,
                               headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(r, timeout=120)
    return resp.read() if raw else json.load(resp)

for k in KINDS:
    body = dict(BASE, **CFG[k])
    t0 = time.time()
    v = req("/v1/videos", body)
    aborted = None
    while v.get("status") in ("queued", "in_progress"):
        time.sleep(3)
        v = req("/v1/videos/" + v["id"])
        if time.time() - t0 > 600:  # Nutzerwunsch: nichts ueber 10 min, abbrechen und hochrechnen
            aborted = {"after_s": round(time.time() - t0, 1), "progress": v.get("progress")}
            urllib.request.urlopen(urllib.request.Request(URL + "/v1/videos/" + v["id"], method="DELETE"), timeout=60)
            break
    dt = time.time() - t0
    res = {"run": k, "status": v.get("status"), "wall_s": round(dt, 1), "video": {x: v.get(x) for x in
           ("seconds", "size", "latent_upscale", "upscale_refine_steps", "upscale_from", "error")}, "aborted": aborted, "progress": v.get("progress")}
    if v.get("status") == "completed":
        open(f"radiance_{k}.mp4", "wb").write(req(f"/v1/videos/{v['id']}/content", raw=True))
    print(json.dumps(res), flush=True)
