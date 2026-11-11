import json,sys,time,threading,urllib.request
port,model,c=sys.argv[1],sys.argv[2],int(sys.argv[3])
P=json.load(open(sys.argv[4]))
res=[]
def w(i):
    b={"model":model,"messages":[{"role":"user","content":P[i%len(P)]["text"]}],"max_tokens":256,"temperature":0,"top_k":1,"seed":42}
    r=urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions",json.dumps(b).encode(),{"Content-Type":"application/json"})
    d=json.load(urllib.request.urlopen(r,timeout=900)); res.append(d["usage"]["completion_tokens"])
t=time.time(); th=[threading.Thread(target=w,args=(i,)) for i in range(c)]
[x.start() for x in th]; [x.join() for x in th]; dt=time.time()-t
print(json.dumps({"c":c,"tokens":sum(res),"s":round(dt,2),"agg_tps":round(sum(res)/dt,1),"per_stream":round(sum(res)/dt/c,1)}))
