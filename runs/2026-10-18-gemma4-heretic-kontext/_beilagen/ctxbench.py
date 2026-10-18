#!/usr/bin/env python3
"""Kontext-Skalierung: ein Prompt von rund N Token (Zufallswoerter, eine Nadel), danach soll das Modell
das Passwort nennen und eine lange Geschichte schreiben. Gemessen werden Prefill (Prompt-Token / Zeit bis
zum ersten Token) und Decode (ab dem ersten Token, 256 Token).

Aufruf: ctxbench.py PORT MODELL CFG OUTDIR TOKENS[,TOKENS...] [REPS] [KEY]
Jede Wiederholung hat anderen Text und eine andere Nadelposition, damit kein Prompt-Cache trifft.
Schreibt OUTDIR/CFG.json im llmbenches-Format (prompt = ctx<N>k) und OUTDIR/CFG.antworten.txt
(Antwortanfang, Nadel gefunden ja/nein, Token-Zahlen)."""
import json, os, random, sys, time, urllib.request

port, model, cfg, out, toks = sys.argv[1:6]
reps = int(sys.argv[6]) if len(sys.argv) > 6 else 3
key = sys.argv[7] if len(sys.argv) > 7 else ""
targets = [int(t) for t in toks.split(",")]
NPRED = 256
URL = f"http://127.0.0.1:{port}/v1/chat/completions"


def call(text, npred, think=False):
    body = {"model": model, "messages": [{"role": "user", "content": text}], "max_tokens": npred,
            "temperature": 0, "top_k": 1, "seed": 42, "stream": True, "cache_prompt": False,
            "stream_options": {"include_usage": True}, "chat_template_kwargs": {"enable_thinking": think}}
    req = urllib.request.Request(URL, json.dumps(body).encode(), {
        "Content-Type": "application/json", **({"Authorization": f"Bearer {key}"} if key else {})})
    t0 = time.time(); first = None; last = t0; usage = {}; txt = ""
    with urllib.request.urlopen(req, timeout=7200) as r:
        for line in r:
            line = line.decode().strip()
            if not line.startswith("data:") or line.endswith("[DONE]"):
                continue
            ev = json.loads(line[5:])
            if ev.get("usage"):
                usage = ev["usage"]
            ch = ev.get("choices") or []
            if ch:
                d = ch[0].get("delta") or {}
                c = (d.get("content") or "") + (d.get("reasoning_content") or "")
                if c:
                    now = time.time()
                    if first is None:
                        first = now
                    last = now
                    txt += c
    n = usage.get("completion_tokens", 0); pn = usage.get("prompt_tokens", 0)
    dec = max(last - (first or last), 1e-6)
    return {"pred_n": n, "pred_ms": dec * 1000, "tps": (n - 1) / dec if n > 1 else 0.0, "prompt_n": pn,
            "prompt_tps": pn / (first - t0) if first else 0.0, "ttft_ms": ((first or t0) - t0) * 1000}, txt


def make(chars, seed):
    rnd = random.Random(seed)
    words = ["".join(rnd.choices("abcdefghilmnoprstuvz", k=rnd.randint(3, 9))) for _ in range(5000)]
    buf, n = [], 0
    while n < chars:
        s = " ".join(rnd.choices(words, k=14)) + "."
        buf.append(s); n += len(s) + 1
    code = "%s-%s-%04d" % (rnd.choice(["BLAUER", "ROTER", "GRUENER", "GELBER"]),
                           rnd.choice(["OTTER", "FALKE", "LUCHS", "BIBER"]), rnd.randint(1000, 9999))
    buf.insert(rnd.randint(len(buf) // 5, len(buf) * 4 // 5), f"WICHTIGE INFO: Das Passwort des Tresors lautet {code}.")
    q = ("\n\nFrage: Wie lautet das Passwort des Tresors? Nenne zuerst nur das Passwort in einer Zeile, "
         "schreibe danach eine ausfuehrliche Geschichte ueber einen Leuchtturmwaerter (mindestens 400 Woerter).")
    return "\n".join(buf) + q, code


# Zeichen je Token einmal an einem kurzen Text bestimmen (derselbe Wortschatz)
probe, _ = make(20000, 1)
pr, _ = call(probe, 1)
cpt = len(probe) / max(pr["prompt_n"], 1)
print(f"{cpt:.2f} Zeichen je Token", flush=True)
call("Hallo", 16)  # Warmlauf

rows, answers = [], []
for tgt in targets:
    pid = f"ctx{tgt // 1024}k"
    for rep in range(1, reps + 1):
        text, code = make(int(tgt * cpt), 1000 * tgt + rep)
        r, ans = call(text, NPRED)
        ok = code in ans[:200]
        rows.append({"cfg": cfg, "prompt": pid, "rep": rep, "draft_n": None, "draft_accepted": None, **r})
        answers.append({"prompt": pid, "rep": rep, "nadel": code, "gefunden": ok, "prompt_n": r["prompt_n"],
                        "antwort": ans[:300]})
        print(pid, rep, "pp", r["prompt_n"], "tok", round(r["prompt_tps"]), "pp t/s", round(r["tps"], 1),
              "tg t/s nadel", ok, flush=True)
        os.makedirs(out, exist_ok=True)
        json.dump(rows, open(f"{out}/{cfg}.json", "w"), indent=1)
        json.dump(answers, open(f"{out}/{cfg}.antworten.txt", "w"), indent=1, ensure_ascii=False)
