#!/usr/bin/env python3
"""Sammelt alle Messlaeufe aus runs/ ein und schreibt data.json und data.js.

Aufruf: python3 tools/collect.py
Danach zeigt index.html den neuen Stand, auch per Doppelklick ohne Webserver.
"""
import json, os, re, statistics as st, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNS = os.path.join(ROOT, "runs")


def vram_from_log(path):
    """Liest je Konfiguration den VRAM-Stand aus der Zeile '### cfg: bereit, VRAM x GiB'."""
    out = {}
    if not os.path.exists(path):
        return out
    for line in open(path, errors="replace"):
        m = re.search(r"###\s+(\S+):\s+bereit,\s+VRAM\s+([\d,.]+)\s*GiB", line)
        if m:
            out[m.group(1)] = float(m.group(2).replace(",", "."))
    return out


def error_from_log(path):
    """Letzte echte Fehlerzeile eines gescheiterten Serverstarts."""
    if not os.path.exists(path):
        return None
    errs = [l.strip() for l in open(path, errors="replace") if re.search(r"\sE\s|error|failed", l, re.I)]
    ignore = ("draft head without its own", "failed to measure the memory")
    errs = [e for e in errs if not any(i in e for i in ignore)]
    if not errs:
        return None
    # Die aussagekraeftigste Zeile schlaegt die erste: ein blosses "failed to load model"
    # steht oft vor der eigentlichen Ursache.
    telling = ("out of memory", "unable to allocate", "not supported", "no such file")
    e = next((x for x in errs if any(t in x.lower() for t in telling)), errs[0])
    return re.sub(r"^\d+\.\d+\.\d+\.\d+\s+\w+\s+\S+\s*", "", e)[:300]


def stats(values):
    return {
        "n": len(values),
        "min": round(min(values), 2),
        "median": round(st.median(values), 2),
        "max": round(max(values), 2),
        "mean": round(st.fmean(values), 2),
        "spread_pct": round((max(values) - min(values)) / st.median(values) * 100, 1),
        "values": [round(v, 2) for v in values],
    }


def load_backend(bdir):
    """Ein Backend-Ordner: je Konfiguration eine <cfg>.json, dazu run.log und <cfg>.server.log."""
    vram = vram_from_log(os.path.join(bdir, "run.log"))
    cfgs = {}
    seen = set()
    for fn in sorted(os.listdir(bdir)):
        if fn.endswith(".json"):
            seen.add(fn[:-5])
        elif fn.endswith(".server.log"):
            seen.add(fn[:-len(".server.log")])
    for cfg in sorted(seen):
        jpath = os.path.join(bdir, cfg + ".json")
        logpath = os.path.join(bdir, cfg + ".server.log")
        if not os.path.exists(jpath):
            cfgs[cfg] = {"status": "failed", "error": error_from_log(logpath) or "kein Ergebnis",
                         "vram_gib": vram.get(cfg)}
            continue
        rows = json.load(open(jpath))
        prompts, all_v = {}, []
        tot_dn = tot_da = tot_pn = 0
        for pid in sorted({r["prompt"] for r in rows}):
            rs = [r for r in rows if r["prompt"] == pid]
            vals = [r["tps"] for r in rs]
            all_v += vals
            dn = sum(r.get("draft_n") or 0 for r in rs)
            da = sum(r.get("draft_accepted") or 0 for r in rs)
            pn = sum(r["pred_n"] for r in rs)
            tot_dn += dn; tot_da += da; tot_pn += pn
            e = stats(vals)
            e["acceptance"] = round(da / dn * 100, 1) if dn else None
            e["mean_len"] = round(pn / (pn - da), 2) if dn and pn > da else None
            e["pred_n"] = int(st.median([r["pred_n"] for r in rs]))
            e["prompt_tps"] = round(st.median([r["prompt_tps"] for r in rs if r.get("prompt_tps")]), 1) \
                if any(r.get("prompt_tps") for r in rs) else None
            prompts[pid] = e
        overall = stats(all_v)
        overall["acceptance"] = round(tot_da / tot_dn * 100, 1) if tot_dn else None
        overall["mean_len"] = round(tot_pn / (tot_pn - tot_da), 2) if tot_dn and tot_pn > tot_da else None
        cfgs[cfg] = {"status": "ok", "vram_gib": vram.get(cfg), "prompts": prompts, "overall": overall}
    return cfgs


def main():
    runs = []
    if not os.path.isdir(RUNS):
        print("kein runs/-Ordner", file=sys.stderr); return 1
    for rid in sorted(os.listdir(RUNS), reverse=True):
        rdir = os.path.join(RUNS, rid)
        mpath = os.path.join(rdir, "meta.json")
        if not os.path.isdir(rdir) or not os.path.exists(mpath):
            continue
        meta = json.load(open(mpath))
        meta.setdefault("id", rid)
        results = {}
        for b in sorted(os.listdir(rdir)):
            bdir = os.path.join(rdir, b)
            if os.path.isdir(bdir):
                cfgs = load_backend(bdir)
                if cfgs:
                    results[b] = cfgs
        # Speedup je Backend gegen dessen eigene baseline
        for b, cfgs in results.items():
            base = cfgs.get("baseline", {})
            bm = base.get("overall", {}).get("median") if base.get("status") == "ok" else None
            for cfg, e in cfgs.items():
                if e.get("status") != "ok":
                    continue
                e["speedup"] = round(e["overall"]["median"] / bm, 3) if bm else None
                for pid, pe in e["prompts"].items():
                    pb = base.get("prompts", {}).get(pid, {}).get("median") if bm else None
                    pe["speedup"] = round(pe["median"] / pb, 3) if pb else None
        meta["results"] = results
        runs.append(meta)

    data = {"generated": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
            "runs": runs}
    with open(os.path.join(ROOT, "data.json"), "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    with open(os.path.join(ROOT, "data.js"), "w") as f:
        f.write("// erzeugt von tools/collect.py, nicht von Hand aendern\n")
        f.write("window.BENCH_DATA = ")
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write(";\n")
    nb = sum(len(r["results"]) for r in runs)
    nc = sum(len(c) for r in runs for c in r["results"].values())
    print(f"{len(runs)} Lauf/Laeufe, {nb} Backends, {nc} Konfigurationen -> data.json, data.js")
    return 0


if __name__ == "__main__":
    sys.exit(main())
