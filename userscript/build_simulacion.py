# Construye la simulación. El userscript de producción NO se toca: aquí solo se
# neutralizan, para la demo, dos cosas que existen por seguridad en el real.
import re, sys
src = open('/home/claude/repo/userscript/vigilante_agenda.user.js', encoding='utf-8').read()
body = src.split('// ==/UserScript==', 1)[1]

parches = [
  # 1) El script real se niega a correr dentro de un frame (evita recursión con el clon).
  #    La vista previa muestra el HTML dentro de un iframe -> hay que permitirlo en la demo.
  ('if (window.top !== window.self) return; // nunca correr dentro de un frame (incl. el clon)',
   'if (false) return; // [SIMULACIÓN] en el script real aquí se bloquea la ejecución dentro de un frame'),
  # 2) El clon invisible apunta a /viva/HCHealth/ y en la demo solo produciría un 404.
  ('  function ensureClone() {\n    if (CLONE.frame || !document.body) return;',
   '  function ensureClone() {\n    return; // [SIMULACIÓN] sin clon: la demo lee la agenda de esta misma página\n  }\n  function ensureCloneReal() {\n    if (CLONE.frame || !document.body) return;'),
]
for a, b in parches:
    if a not in body: sys.exit('NO ENCONTRADO: ' + a[:60])
    body = body.replace(a, b)

partes = [open(f, encoding='utf-8').read() for f in ('head.html', 'cards.html', 'tail.html')]
open('simulacion_vigilante_v5.html', 'w', encoding='utf-8').write(
    partes[0] + partes[1] + partes[2] + body + '\n' + open('close.html', encoding='utf-8').read())
print('simulación reconstruida')
