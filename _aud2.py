import struct, sys, os, zlib, re

EXE = r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\vigilante_agenda.exe"
OUT = r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\_aud2"
MAGIC = b'MEI\014\013\012\013\016'

data = open(EXE, 'rb').read()
pos = data.rfind(MAGIC)
magic, lengthofPackage, toc, tocLen, pyver, pylibname = struct.unpack('!8siiii64s', data[pos:pos+88])
archive_start = pos + 88 - lengthofPackage
tocpos = archive_start + toc
os.makedirs(OUT, exist_ok=True)

p, end = tocpos, tocpos + tocLen
raw = None
while p < end:
    (entrySize,) = struct.unpack('!i', data[p:p+4])
    if entrySize <= 18 or p + entrySize > end:
        break
    nameLen = entrySize - 18
    entryPos, csz, usz, flag, typ, name = struct.unpack('!iiiBc%ds' % nameLen, data[p+4:p+entrySize])
    name = name.rstrip(b'\0').decode('utf-8', 'replace')
    if name == 'vigilante_agenda':
        raw = data[archive_start+entryPos: archive_start+entryPos+csz]
        if flag:
            raw = zlib.decompress(raw)
        break
    p += entrySize

open(os.path.join(OUT, 'v.pyc'), 'wb').write(raw)
txt = raw.decode('utf-8', errors='replace')
cands = re.findall(r"[\x20-\x7E\u00a1-\u00ff]{3,}", txt)
seen = []
for c in cands:
    c = c.strip()
    if len(c) >= 3 and c not in seen:
        seen.append(c)

print("=== BLOQUE ENCABEZADOS / CAMPOS CSV ===")
for i, s in enumerate(seen):
    if re.search(r'Hora cita|Documento|Paciente|Estado|Minutos|Confianza|Clasificac|Observ|Evidencia|Detalle|Modalidad|Fecha', s):
        print(i, repr(s))

print("\n=== CLAVES JSON / dataclass fields ===")
for s in seen:
    if re.search(r'^(hora|doc|pac|est|min|conf|clas|obs|evid|detall|modal|fecha|instante|ahora|retras|seg|alert|cita|turno|resumen|generado|version)', s, re.I) and len(s) < 40:
        print(repr(s))
