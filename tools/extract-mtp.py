"""Schlanken MTP-Draft-Head aus einem GGUF mit nextn-Layer herausschneiden.

Vorbild ist unsloth/Qwen3.8-Flash-Next-GGUF/MTP/mtp-...-shared-Q8_0.gguf:
genau ein Block (der nextn-Layer), keine token_embd und keine output-Projektion
-- die leiht sich der Head zur Laufzeit vom Zielmodell. Das Flag dafuer ist
<arch>.nextn_shared_target_tensors = true.

Qwen3.8-27B (qwen35) bringt den Layer als blk.64 mit, llama.cpp ignoriert ihn
beim normalen Laden ("model has unused tensor blk.64.* -- ignoring"). Als
eigenes -md-Modell wird daraus ein 0,33-GiB-Draft statt eines zweiten 20,5-GiB-
Modells.

Erst pruefen, ob es das ueberhaupt braucht: seit llama.cpp b10440 (PR 22673)
laedt --spec-type draft-mtp den Layer aus dem Hauptmodell selbst, ganz ohne -md.
Am 2026-09-14 fuer Qwen3.8-27B nachgemessen, es funktioniert. Dieses Skript ist
dann nur noch fuer aeltere Builds und fuer Modelle noetig, die den Layer nicht
mitbringen.
"""
import sys
import gguf

src_path, dst_path = sys.argv[1], sys.argv[2]
r = gguf.GGUFReader(src_path)

arch = r.fields["general.architecture"].contents()
n_blocks = r.fields["%s.block_count" % arch].contents()
mtp_block = n_blocks - 1                      # der nextn-Layer ist der letzte
prefix = "blk.%d." % mtp_block

tensors = [t for t in r.tensors if t.name.startswith(prefix)]
if not tensors:
    sys.exit("Kein Block %s in %s" % (prefix, src_path))
if not any("nextn" in t.name for t in tensors):
    sys.exit("Block %s enthaelt keine nextn-Tensoren, das ist kein MTP-Layer" % prefix)

print("Architektur %s, block_count %d, MTP-Layer %s" % (arch, n_blocks, prefix.rstrip(".")))
print("%d Tensoren, %.2f GiB" % (len(tensors), sum(t.n_bytes for t in tensors) / 2**30))

w = gguf.GGUFWriter(dst_path, arch)

# Metadaten uebernehmen. general.architecture setzt der Writer selbst.
skip = {"general.architecture", "general.name"}
copied = 0
for key, f in r.fields.items():
    if key.startswith("GGUF.") or key in skip:
        continue
    vtype = f.types[0]
    sub = f.types[1] if vtype == gguf.GGUFValueType.ARRAY and len(f.types) > 1 else None
    w.add_key_value(key, f.contents(), vtype, sub_type=sub)
    copied += 1

# Das eine Feld, das den Head zum Shared-Head macht.
w.add_key_value("%s.nextn_shared_target_tensors" % arch, True, gguf.GGUFValueType.BOOL)
w.add_key_value("general.name", "Qwen3.8-27B MTP shared head", gguf.GGUFValueType.STRING)
print("%d Metadatenfelder uebernommen, nextn_shared_target_tensors gesetzt" % copied)

for t in tensors:
    # t.data traegt bei quantisierten Tensoren die Byte-Form (uint8) und bei F32
    # die Elementform. add_tensor_info rechnet die Byte-Form selbst zurueck,
    # solange dtype uint8 ist -- also unveraendert durchreichen.
    w.add_tensor(t.name, t.data, raw_dtype=t.tensor_type)

w.write_header_to_file()
w.write_kv_data_to_file()
w.write_tensors_to_file(progress=False)
w.close()
print("geschrieben: %s" % dst_path)
