import re
with open("commit_message.txt", "r", encoding="utf-8") as f:
    content = f.read()

new_diff = """ tests/INFORME_MUTACIONES.md     |  1 +
 tests/suite_02_tiempo_fechas.js | 58 ++++++++++++++++++++++++++---
 vigilante_agenda.user.js        | 41 ++++++++++++++++++---
 3 files changed, 94 insertions(+), 6 deletions(-)"""

content = re.sub(r' tests/INFORME_MUTACIONES\.md.*3 files changed.*?\(-\)', new_diff, content, flags=re.DOTALL)
with open("commit_message.txt", "w", encoding="utf-8") as f:
    f.write(content)
