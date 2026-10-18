import base64, json, sys, time, urllib.request
prompt, size, steps, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
seed = int(sys.argv[5]) if len(sys.argv) > 5 else 1
body = {"model": "qwen-image-2.1-noctq", "prompt": prompt, "size": size, "seed": seed,
        "num_inference_steps": steps, "negative_prompt": "low quality, blurry, distorted", "true_cfg_scale": 3}
t = time.time()
r = urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8951/v1/images/generations",
        json.dumps(body).encode(), {"Content-Type": "application/json"}), timeout=900)
d = json.load(r); dt = time.time() - t
open(out, "wb").write(base64.b64decode(d["data"][0]["b64_json"]))
print(f"{size} {steps} Schritte: {dt:.1f} s -> {out}", {k: v for k, v in d.get("usage", {}).items()})
