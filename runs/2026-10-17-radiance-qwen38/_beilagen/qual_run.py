import json,sys,urllib.request
port,model,out=sys.argv[1:4]
key=sys.argv[4] if len(sys.argv)>4 else ""
res={}
for p in json.load(open('/home/alex/radiance-work/qual/prompts.json')):
    b={"model":model,"messages":[{"role":"user","content":p["text"]}],"max_tokens":600,"temperature":0,"top_k":1,"seed":42,"chat_template_kwargs":{"enable_thinking":False}}
    h={"Content-Type":"application/json"}
    if key:h["Authorization"]="Bearer "+key
    d=json.load(urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions",json.dumps(b).encode(),h),timeout=1500))
    m=d["choices"][0]["message"]
    res[p["id"]]={"content":m.get("content"),"reasoning":m.get("reasoning_content"),"n":d["usage"]["completion_tokens"]}
    print(p["id"],res[p["id"]]["n"])
json.dump(res,open(out,"w"),indent=1,ensure_ascii=False)
