import json,random,time,urllib.request,sys
target_chars=int(sys.argv[1]); random.seed(1)
words=[''.join(random.choices('abcdefghilmnoprstuvz',k=random.randint(3,9))) for _ in range(5000)]
buf=[]; n=0
while n<target_chars:
    s=' '.join(random.choices(words,k=14))+'.'; buf.append(s); n+=len(s)+1
mid=len(buf)//3
buf.insert(mid,"WICHTIGE INFO: Das Passwort des Tresors lautet BLAUER-OTTER-4711.")
text='\n'.join(buf)
body={"model":"qwen3.8-27b-radiance","messages":[{"role":"user","content":text+"\n\nFrage: Wie lautet das Passwort des Tresors? Antworte nur mit dem Passwort."}],"max_tokens":120,"chat_template_kwargs":{"enable_thinking":False},"temperature":0,"top_k":1,"seed":42,"stream":True,"stream_options":{"include_usage":True}}
req=urllib.request.Request("http://127.0.0.1:8952/v1/chat/completions",json.dumps(body).encode(),{"Content-Type":"application/json"})
t0=time.time(); first=None; out=""; usage={}
try:
    r=urllib.request.urlopen(req,timeout=3000)
except urllib.error.HTTPError as e:
    print(e.read().decode()[:400]); sys.exit(1)
with r:
    for line in r:
        line=line.decode().strip()
        if not line.startswith("data:") or line.endswith("[DONE]"): continue
        ev=json.loads(line[5:])
        if ev.get("usage"): usage=ev["usage"]
        ch=ev.get("choices") or []
        if ch:
            d=ch[0].get("delta") or {}
            c=(d.get("content") or "")
            if c or d.get("reasoning_content"):
                if first is None: first=time.time()
                out+=c
t1=time.time()
print("prompt_tokens",usage.get("prompt_tokens"),"completion",usage.get("completion_tokens"))
print("TTFT %.1f s -> Prefill %.0f t/s"%(first-t0,usage["prompt_tokens"]/(first-t0)))
print("Decode %.1f t/s"%((usage["completion_tokens"]-1)/max(t1-first,1e-6)))
print("Antwort:",out.strip()[:120])
