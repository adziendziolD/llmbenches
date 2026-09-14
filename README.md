# llmbenches

Messergebnisse lokaler LLM-Laeufe und ein kleines Werkzeug, das sie anzeigt.

Der Anspruch ist, dass eine Zahl ohne ihren Kontext wertlos ist. Jeder Lauf traegt deshalb
Hardware, Build, Startzeile und Methodik mit sich, und die Anzeige zeigt neben dem Median
immer auch die Streuung der Einzelmessungen. Gescheiterte Konfigurationen werden nicht
weggelassen, sondern mit ihrer Fehlermeldung ausgewiesen.

## Ansehen

```
python3 tools/collect.py     # Ergebnisse einsammeln
xdg-open index.html          # oder die Datei doppelklicken
```

`index.html` braucht keinen Webserver und laedt nichts aus dem Netz. Wer mag, kann trotzdem
einen starten, dann holt die Seite Aenderungen an `data.json` ohne Neuladen nach:

```
python3 -m http.server 8777   # dann http://127.0.0.1:8777/
```

## Einen Lauf hinzufuegen

Ein Lauf ist ein Ordner unter `runs/`, darin je Backend ein Unterordner:

```
runs/2026-09-13-qwen38-mtp/
  meta.json              Beschreibung des Laufs, siehe unten
  vulkan/                ein Unterordner je Backend
    baseline.json        Messwerte einer Konfiguration
    baseline.server.log  Serverlog als Beleg, optional
    run.log              enthaelt die VRAM-Zeilen, optional
  rocm/
    ...
```

Der Dateiname ohne Endung ist die Konfiguration, der Ordnername das Backend. Fehlt zu einer
Konfiguration die `.json`, existiert aber ein `.server.log`, gilt sie als gescheitert und die
Anzeige nennt die Ursache aus dem Log.

Eine Messdatei ist eine Liste von Einzelmessungen:

```json
[{ "cfg": "mtp2", "prompt": "code", "rep": 1, "pred_n": 256,
   "tps": 31.43, "prompt_tps": 139.0, "draft_n": 140, "draft_accepted": 115 }]
```

`draft_n` und `draft_accepted` duerfen fehlen, dann entfaellt die Akzeptanzrate.

`meta.json` beschreibt den Lauf. `machine`, `model` und `method` sind freie
Schluessel-Wert-Paare und werden als Steckbrief angezeigt -- kurze Werte, eine Zeile,
keine Absaetze; alles Ausfuehrliche gehoert nach `notes`, `backends`, `configs` und `prompts`
liefern die Beschriftungen, `notes` die Befunde:

```json
{
  "title": "...", "date": "2026-09-13", "question": "...",
  "machine": { "GPU": "..." }, "model": { "Modell": "..." }, "method": { "Kontext": "..." },
  "cmdline": "...",
  "backends": { "vulkan": { "label": "Vulkan", "device": "Vulkan0" } },
  "configs":  { "baseline": { "label": "ohne MTP", "order": 0 } },
  "prompts":  { "code": "kurze Beschreibung" },
  "notes": ["..."]
}
```

Heisst eine Konfiguration `baseline`, dienen ihre Werte als Bezug fuer den Speedup des
jeweiligen Backends.

Danach `python3 tools/collect.py` ausfuehren. Das Skript schreibt `data.json` und `data.js`;
beide liegen im Repo, damit die Seite auch ohne Webserver etwas anzuzeigen hat.

## MTP-Draft-Head selbst schneiden

**Meistens ist das unnoetig, nachgetragen am 2026-09-14.** Seit llama.cpp b10440
(PR 22673) laedt `--spec-type draft-mtp` den `blk.N.nextn`-Layer aus dem
Hauptmodell selbst, sofern er darin steckt. Ein `-md` braucht es dann gar nicht.
Auf dieser Maschine geprueft, indem der Server bewusst ohne `-md` gestartet und
nachgesehen wurde, ob ueberhaupt gedraftet wird: `Qwen3.8-27B-UD-Q6_K` erreicht
so 0,803 Akzeptanz, die abliterierte Schwester 0,838, beide ohne
`unused tensor`-Warnung. Das Werkzeug hier bleibt trotzdem richtig fuer Modelle,
die den Layer nicht mitbringen -- `Qwen3.8-Flash-Next` etwa hat in keinem seiner
drei Splits einen `nextn`-Tensor und braucht den veroeffentlichten Shared-Head.
Der Dateiname verraet das uebrigens nicht: `Qwen3.8-27B-UD-Q6_K` traegt den Layer,
ohne ihn im Namen zu nennen. Sicherheit gibt nur die Tensorliste oder derselbe
Testlauf, siehe `llama-launcher/scripts/pruefe-eingebettetes-mtp.sh`.

`tools/extract-mtp.py` baut aus einem GGUF mit nextn-Layer einen schlanken
Shared-Draft-Head, wie ihn `llama-server -md ... --spec-type draft-mtp`
erwartet.

Hintergrund: Modelle mit Multi-Token-Prediction tragen den MTP-Layer als
letzten Block im GGUF mit (bei Qwen3.8-27B ist das `blk.64`, 15 Tensoren,
0,33 GiB). **Ohne** `--spec-type draft-mtp` benutzt llama.cpp ihn nicht und
meldet `model has unused tensor blk.64.* -- ignoring`. Aeltere Builds als b10440
brauchen ihn zwingend als eigene Datei. Unsloth veroeffentlicht solche Heads nur
fuer einzelne Architekturen; fuer `qwen35` gibt es keinen.

```
python3 tools/extract-mtp.py modell.gguf MTP/mtp-modell-shared.gguf
```

Das Skript kopiert die Tensoren des letzten Blocks verbatim, uebernimmt alle
Metadaten und Tokenizer-Felder und setzt `<arch>.nextn_shared_target_tensors`.
Dieses Flag macht den Head zum *shared* Head: er bringt weder `token_embd` noch
Output-Projektion mit, sondern leiht beides vom Zielmodell. Deshalb ist die
Fehlermeldung beim Start

```
borrow_shared_tensor: this model is a draft head without its own
'token_embd.weight'; load it as a draft of its target model, not on its own
```

erwartet und harmlos: sie kommt aus dem Versuch von `--fit`, den Head zur
Speichermessung einzeln zu laden. Direkt danach laedt ihn llama.cpp als Draft.

Das Skript braucht `gguf-py`. Auf dieser Maschine liegt es in der
comfyui-venv:

```
~/llmstore/software/comfyui/.venv/bin/python tools/extract-mtp.py ...
```

Der Fork muss fuer die Architektur einen MTP-Graphen mitbringen. Nachsehen mit:

```
nm -D --defined-only libllama.so | c++filt | grep graph_mtp
```

## Messwerkzeug

`runs/2026-09-13-qwen38-mtp/mtp-bench.sh` ist das Skript, mit dem diese Reihe entstanden ist.
Es startet den Server je Konfiguration neu, wartet auf `/health`, macht einen Warmlauf und
misst dann jeden Prompt mehrfach ueber `/completion`, greedy und mit festem Seed. Backend,
Geraet, Port und `--fit-target` kommen aus Umgebungsvariablen:

```
BIN=.../llama-server DEVICE=ROCm0 PORT=8901 FIT_TARGET=3600 ./mtp-bench.sh ergebnisordner mtp2
```
