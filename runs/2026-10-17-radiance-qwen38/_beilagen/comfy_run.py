import json, sys, time, urllib.request, urllib.parse, os
BASE = "http://127.0.0.1:8888"
KEY = [l.split("=",1)[1].strip() for l in open(os.path.expanduser("~/git/llm-router/.env")) if l.startswith("ROUTER_API_KEY=")][0]
H = {"Authorization": "Bearer " + KEY, "Content-Type": "application/json"}
def call(path, body=None, method=None, timeout=1800):
    req = urllib.request.Request(BASE + path, json.dumps(body).encode() if body is not None else None, H, method=method)
    return json.load(urllib.request.urlopen(req, timeout=timeout))
def run(wf, body):
    t = time.time()
    r = call("/comfyui/workflows/" + urllib.parse.quote(wf) + "/run", body)
    jid = r["job_id"]
    while True:
        j = call("/comfyui/jobs/" + jid)
        if j["status"] in ("done", "error", "interrupted", "cancelled"):
            return j, time.time() - t
        time.sleep(1)
if __name__ == "__main__":
    wf = sys.argv[1]; body = json.loads(sys.argv[2])
    j, dt = run(wf, body)
    print(wf, "->", j["status"], f"{dt:.1f} s", j.get("error") or "", [m["saved_to"] for m in (j.get("result") or {}).get("media", [])])
