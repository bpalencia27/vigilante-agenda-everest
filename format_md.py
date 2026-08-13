import re

with open('tests/INFORME_MUTACIONES.md', 'r') as f:
    content = f.read()

# Fix the format of the added row
content = content.replace("| 6318 | `if (!resultVal) return;` -> `if (resultVal) return;` | No | - |", "| 6318 | `if (!resultVal) return;` &rarr; `if (resultVal) return;` | No | - |")

with open('tests/INFORME_MUTACIONES.md', 'w') as f:
    f.write(content)
