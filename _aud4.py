import re

raw = open(r"c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\_aud2\v.pyc", 'rb').read()
txt = raw.decode('utf-8', errors='replace')
cands = re.findall(r"[\x20-\x7E\u00a1-\u00ff]{1,}", txt)
seen = []
for c in cands:
    if c not in seen:
        seen.append(c)

print("=== PREFIJOS FORMULA (anti CSV injection) ===")
for i, s in enumerate(seen):
    if re.search(r'PREFIJOS|sanear', s):
        for j in range(max(0,i-12), min(len(seen), i+4)):
            print(j, repr(seen[j]))
        print('---')

print("\n=== SEPARADOR / ENCODING ===")
for s in seen:
    if s in (';', ',', '\t', 'utf-8-sig', 'utf-8') or re.search(r'delimiter|utf-8', s):
        print(repr(s))

print("\n=== JSON: claves de nivel superior ===")
for i, s in enumerate(seen):
    if s in ('generado_en','version','fecha_agenda','resumen','citas','config','sello','instantes'):
        print(i, repr(s))
