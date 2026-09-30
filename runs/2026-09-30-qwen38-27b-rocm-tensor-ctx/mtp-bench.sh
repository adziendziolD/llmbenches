#!/usr/bin/env bash
# Kontext-Stufen (CTX) mit langem Prompt (ca. 3,5k Token), ROCm Tensor-Split auf zwei R9700, Qwen3.8-27B mit eingebettetem MTP-Head.
# Env: DEVICE (z.B. ROCm0,ROCm1), GGML_CUDA_P2P (1 = Peer-Access), SPLIT (none|layer|tensor), PARALLEL, KVU, MMPROJ.
# Urspruenglich: A/B-Messreihe MTP-Speculative-Decoding, Qwen3.8-27B (qwen35) auf Vulkan.
#
# Anders als bei Flash-Next gibt es fuer diese Architektur keinen
# veroeffentlichten Draft-Head. Der hier benutzte ist aus blk.64 des Modells
# selbst geschnitten, siehe tools/extract-mtp.py.
#
# PARALLEL ist die zweite Dimension: laut Upstream kippt der MTP-Gewinn bei
# Nebenlaeufigkeit ueber 1 ins Negative. Das Katalogpreset laeuft auf 3.
set -u

BIN=${BIN:-/home/alex/llmstore/software/llama.cpp/rocm/llama-server}
MODEL=/home/alex/llmstore/qwen/qwen3_8/Qwen3.8-27B-UD-Q6_K.gguf
PORT=${PORT:-8899}
PARALLEL=${PARALLEL:-1}
CTX=${CTX:-262144}
OUT="$1"
CFG="$2"
NPRED=256

mkdir -p "$OUT"
LOG="$OUT/$CFG.server.log"

ARGS=(--host 127.0.0.1 --port "$PORT" -m "$MODEL"
      --ctx-size "$CTX" --device ${DEVICE:-ROCm0} --flash-attn on --split-mode ${SPLIT:-none}
      --cache-type-k q8_0 --cache-type-v q8_0
      --parallel "$PARALLEL" --no-webui)
[ "${KVU:-auto}" = "yes" ] || { [ "${KVU:-auto}" = "auto" ] && [ "$PARALLEL" -gt 1 ]; } && ARGS+=(--kv-unified)
[ -n "${MMPROJ:-}" ] && ARGS+=(--mmproj "$MMPROJ")

case "$CFG" in
  baseline) ;;
  mtp1) ARGS+=(--spec-type draft-mtp --spec-draft-n-max 1) ;;
  mtp2) ARGS+=(--spec-type draft-mtp --spec-draft-n-max 2) ;;
  mtp3) ARGS+=(--spec-type draft-mtp --spec-draft-n-max 3) ;;
  *) echo "unbekannte Konfig: $CFG"; exit 2 ;;
esac

echo "### $CFG (parallel=$PARALLEL): starte Server" | tee -a "$OUT/run.log"
"$BIN" "${ARGS[@]}" >"$LOG" 2>&1 &
SPID=$!
trap 'kill $SPID 2>/dev/null; wait $SPID 2>/dev/null' EXIT

for i in $(seq 1 240); do
  if ! kill -0 $SPID 2>/dev/null; then
    echo "!! Server beendet, siehe $LOG" | tee -a "$OUT/run.log"; tail -25 "$LOG"; exit 3
  fi
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/health" 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 5
done
[ "$code" = "200" ] || { echo "!! Timeout beim Laden" | tee -a "$OUT/run.log"; tail -25 "$LOG"; exit 4; }

VRAM=$(cat /sys/class/drm/card[01]/device/mem_info_vram_used | awk '{printf "%s%.2f", (NR>1?" + ":""), $1/1073741824}')
echo "### $CFG: bereit, VRAM ${VRAM} GiB" | tee -a "$OUT/run.log"

PROMPTS_DIR="$(dirname "$(readlink -f "$0")")" \
python3 - "$PORT" "$NPRED" "$CFG" "$OUT" <<'PY'
import json, os, sys, urllib.request
PROMPTS_DIR = os.environ["PROMPTS_DIR"]
port, npred, cfg, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
base = f"http://127.0.0.1:{port}"

def post(path, payload, timeout=1200):
    req = urllib.request.Request(base+path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

TARGET = 3500
PARAS = [
 "Abschnitt {i}: Die Eigentuemergemeinschaft {i} verwaltet {u} Einheiten mit insgesamt {m} Quadratmetern Wohnflaeche. Die Heizkosten von {k} Euro werden zu {v} Prozent nach Verbrauch und zu {f} Prozent nach Wohnflaeche verteilt. Die Abrechnungsperiode endet am 31. Dezember, die Vorlage beim Verwalter ist bis zum {d}. Tag des Folgemonats vorgesehen. Rueckfragen einzelner Eigentuemer werden schriftlich beantwortet, die Belege liegen ab dem {d}. Tag zur Einsicht aus.",
 "Abschnitt {i}: Fuer das Objekt mit {u} Wohnungen wurde eine Instandhaltungsruecklage von {k} Euro gebildet. Der Beirat schlaegt vor, davon {m} Euro fuer die Sanierung des Daches zu verwenden. Die Eigentuemerversammlung beschliesst mit einfacher Mehrheit, sofern mindestens {v} Prozent der Miteigentumsanteile vertreten sind. Bei Widerspruch von mehr als {f} Prozent wird die Entscheidung vertagt und nach {d} Tagen neu angesetzt.",
 "Abschnitt {i}: Die Wasserzaehler in den {u} Einheiten werden jaehrlich abgelesen, die Kosten von {k} Euro je Kubikmeter werden nach Verbrauch umgelegt. Bei {f} Zaehlern wurde ein Defekt gemeldet, die Schaetzung beruht auf dem Durchschnitt der letzten {d} Monate. Fuer Gewerbeeinheiten gilt ein eigener Schluessel von {v} Prozent. Die Gesamtflaeche der Gewerbeeinheiten betraegt {m} Quadratmeter.",
]
def build_prompt(tokenize):
    tail = "\n\nFasse die obigen Abschnitte in zehn Stichpunkten zusammen und nenne zu jedem Stichpunkt die wichtigste Zahl."
    i, text = 0, ""
    while True:
        i += 1
        text += PARAS[i % 3].format(i=i, u=6+i*3%40, m=300+i*37%900, k=1000+i*853%9000, v=40+i*7%50, f=10+i*11%40, d=5+i*3%25) + "\n\n"
        if i % 5 == 0 and tokenize(text + tail) >= TARGET:
            return text + tail

def ntok(t):
    return len(post("/tokenize", {"content": t})["tokens"])

long_text = build_prompt(ntok)
print(f"  Prompt: {ntok(long_text)} Token", flush=True)
prompts = [{"id": "lang", "text": long_text}]

def templated(text):
    try:
        return post("/apply-template", {"messages": [{"role": "user", "content": text}]})["prompt"]
    except Exception:
        return text

def run(prompt, n):
    return post("/completion", {"prompt": prompt, "n_predict": n, "temperature": 0.0,
                                "top_k": 1, "seed": 42, "cache_prompt": False})

run(templated("Sag kurz hallo."), 16)

rows = []
for p in prompts:
    tp = templated(p["text"])
    for rep in (1, 2, 3, 4):
        r = run(tp, npred)
        t = r.get("timings", {})
        rows.append({"cfg": cfg, "prompt": p["id"], "rep": rep,
                     "pred_n": t.get("predicted_n"),
                     "pred_ms": t.get("predicted_ms"),
                     "tps": t.get("predicted_per_second"),
                     "prompt_n": t.get("prompt_n"),
                     "prompt_tps": t.get("prompt_per_second"),
                     "draft_n": t.get("draft_n"),
                     "draft_accepted": t.get("draft_n_accepted"),
                     "timings_raw": t})
        print(f"  {cfg} {p['id']} rep{rep}: {t.get('predicted_per_second'):.2f} t/s "
              f"({t.get('predicted_n')} tok)", flush=True)

with open(f"{out}/{cfg}.json", "w") as f:
    json.dump(rows, f, indent=2)
print(f"### {cfg}: geschrieben nach {out}/{cfg}.json")
PY
RC=$?

kill $SPID 2>/dev/null; wait $SPID 2>/dev/null
trap - EXIT
sleep 5
echo "### $CFG: fertig (rc=$RC)" | tee -a "$OUT/run.log"
exit $RC
