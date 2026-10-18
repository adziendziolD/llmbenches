#!/usr/bin/env python3
"""H3-T2V in ComfyUI mit den drei Radiance-Einstellungen messen (49 Auswertungen = 50 Gitterpunkte).
Laeufe: warmup (Modelle laden), native, up12 (latent_upscale 2, 12 Nachschritte), up20 (20 Nachschritte)."""
import json, sys, time, urllib.request, uuid

URL = "http://127.0.0.1:8188"
PROMPT = "A red fox trotting through a snowy pine forest, snow crunching underfoot"
SEED, W, H, LEN, STEPS = 7, 1344, 768, 124, 49
UNET = "minimax_h3_fl2va_pruned_fp8_scaled.safetensors"
CLIP = "qwen3vl_32b_minimax_h3_ultra_uncensored_heretic_int8_convrot.safetensors"
VVAE, AVAE = "minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors"
UPM = "minimax_h3_latent_upscaler_3d_fp32.pth"

def req(path, data=None):
    r = urllib.request.Request(URL + path, data=json.dumps(data).encode() if data is not None else None,
                               headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=60))

INFO = {}
def node(g, cls, **inp):
    """Knoten anlegen; fehlende Pflicht-Widgets mit dem Default aus /object_info fuellen."""
    if cls not in INFO:
        INFO[cls] = req("/object_info/" + urllib.parse.quote(cls))[cls]
    for name, spec in INFO[cls]["input"].get("required", {}).items():
        if name in inp:
            continue
        t, opts = spec[0], (spec[1] if len(spec) > 1 else {})
        if isinstance(t, list):
            inp[name] = opts.get("default", t[0])
        elif t == "COMBO":
            inp[name] = opts.get("default", (opts.get("options") or [None])[0])
        elif "default" in opts:
            inp[name] = opts["default"]
    nid = str(len(g) + 1)
    g[nid] = {"class_type": cls, "inputs": inp}
    return nid

def graph(kind, steps=STEPS, w=W, h=H):
    g = {}
    unet = node(g, "UNETLoader", unet_name=UNET, weight_dtype="default")
    clip = node(g, "SelectCLIPDevice", clip=[node(g, "CLIPLoader", clip_name=CLIP, type="minimax", device="default"), 0], device="gpu:1")
    vvae = node(g, "SelectVAEDevice", vae=[node(g, "VAELoader", vae_name=VVAE), 0], device="gpu:1")
    avae = node(g, "SelectVAEDevice", vae=[node(g, "VAELoader", vae_name=AVAE), 0], device="gpu:1")
    up = kind.startswith("up")
    sw, sh = (w // 2, h // 2) if up else (w, h)
    i2v = node(g, "MiniMaxH3ImageToVideo", clip=[clip, 0], vae=[vvae, 0], prompt=PROMPT, width=sw, height=sh, length=LEN)
    guider = node(g, "BasicGuider", model=[unet, 0], conditioning=[i2v, 0])
    sampler = node(g, "KSamplerSelect", sampler_name="res_multistep")
    sig = node(g, "BasicScheduler", model=[unet, 0], scheduler="simple", steps=steps, denoise=1.0)
    noise = node(g, "RandomNoise", noise_seed=SEED)
    if not up:
        out = [node(g, "SamplerCustomAdvanced", noise=[noise, 0], guider=[guider, 0], sampler=[sampler, 0], sigmas=[sig, 0], latent_image=[i2v, 1]), 0]
    else:
        refine = int(kind[2:])
        split = node(g, "SplitSigmas", sigmas=[sig, 0], step=steps - refine)
        s1 = node(g, "SamplerCustomAdvanced", noise=[noise, 0], guider=[guider, 0], sampler=[sampler, 0], sigmas=[split, 0], latent_image=[i2v, 1])
        sep = node(g, "LTXVSeparateAVLatent", av_latent=[s1, 1])
        upl = node(g, "MinimaxH3LatentUpscaler3D", latent=[sep, 0], model_name=UPM, mode="scale by multiplier", **{"mode.scale": 2.0},
                   align=32, enable_temporal_chunking=True, force_unload=True, device="cuda", precision="fp16")
        cat = node(g, "LTXVConcatAVLatent", video_latent=[upl, 0], audio_latent=[sep, 1])
        out = [node(g, "SamplerCustomAdvanced", noise=[node(g, "RandomNoise", noise_seed=SEED + 1), 0], guider=[guider, 0],
                    sampler=[sampler, 0], sigmas=[split, 1], latent_image=[cat, 0]), 0]
    img = node(g, "VAEDecode", samples=out, vae=[vvae, 0])
    aud = node(g, "VAEDecodeAudio", samples=out, vae=[avae, 0])
    vid = node(g, "CreateVideo", images=[img, 0], audio=[aud, 0], fps=24.0)
    node(g, "SaveVideo", video=[vid, 0], filename_prefix="h3bench/comfy_" + kind, format="mp4")
    return g

def run(kind, **kw):
    g = graph(kind, **kw)
    pid = req("/prompt", {"prompt": g, "client_id": str(uuid.uuid4())})["prompt_id"]
    t0 = time.time()
    while True:
        time.sleep(5)
        hist = req("/history/" + pid)
        if pid in hist:
            st = hist[pid]["status"]
            msgs = {m[0]: m[1].get("timestamp") for m in st.get("messages", [])}
            dt = time.time() - t0
            ex = (msgs.get("execution_success", 0) - msgs.get("execution_start", 0)) / 1000 if "execution_success" in msgs else None
            files = [v for o in hist[pid]["outputs"].values() for k in o.values() if isinstance(k, list) for v in k if isinstance(v, dict) and "filename" in v]
            res = {"run": kind, "status": st.get("status_str"), "wall_s": round(dt, 1), "exec_s": ex, "files": files}
            if st.get("status_str") != "success":
                res["error"] = [m for m in st.get("messages", []) if m[0] == "execution_error"]
            print(json.dumps(res), flush=True)
            return res

if __name__ == "__main__":
    import urllib.parse
    kinds = sys.argv[1:] or ["warmup", "native", "up12", "up20"]
    for k in kinds:
        if k == "warmup":
            run("warmup", steps=2, w=672, h=384)
        elif k == "probe":
            # Kurzmessung statt Volllauf (Nutzerwunsch: nichts ueber 10 min), Hochrechnung aus s/it im Log
            run("native", steps=2)
            run("up2", steps=6)
        else:
            run(k)
