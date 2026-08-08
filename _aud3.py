import re

raw = open(r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\_aud2\v.pyc", 'rb').read()
txt = raw.decode('utf-8', errors='replace')
cands = re.findall(r"[\x20-\x7E\u00a1-\u00ff]{3,}", txt)
seen = []
for c in cands:
    c = c.strip()
    if len(c) >= 3 and c not in seen:
        seen.append(c)

print("=== VENTANA 455-545 (encabezados + resumen) ===")
for i in range(450, min(560, len(seen))):
    print(i, repr(seen[i]))

print("\n=== CLASES / CLASIFICACIONES DE ALERTA ===")
for s in seen:
    if re.search(r'EN_REGLA|EN REGLA|INASISTENCIA|EXTEMPOR|EXCLUIDA|PARCIAL|PLENA|regla', s):
        print(repr(s))

print("\n=== VERSION ===")
for s in seen:
    if re.search(r'^\d+\.\d+|VERSION|v\d\.', s) and len(s) < 30:
        print(repr(s))
