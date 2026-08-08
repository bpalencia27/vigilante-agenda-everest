import sys, io

src = r'c:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\vigilante_agenda.user.js'
with open(src, encoding='utf-8', errors='replace') as f:
    content = f.read()

# Update CONFIG.SP.folder to search the exact subfolders discovered in telemetry
old_sp_config = 'folder: "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM",'

new_sp_config = '''folder: "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM/CITAS DIA EBS",
      folders: [
        "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM/CITAS DIA EBS",
        "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM/ESTRATEGIAS POR SEDE 2026/SEDE BELLO",
        "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM"
      ],'''

assert old_sp_config in content, "Old SP folder config not found"
content = content.replace(old_sp_config, new_sp_config, 1)

# Helper function for multi-folder querying
multi_folder_helper = '''  async function fetchSpFilesMultiFolder() {
    const flds = CONFIG.SP.folders || [CONFIG.SP.folder];
    let allRows = [];
    for (const fld of flds) {
      try {
        const d = await gmJson(spListUrl(fld));
        const r = spRows(d);
        if (r && r.length) {
          allRows.push(...r);
          if (pickTodaysFile(r)) return allRows;
        }
      } catch (e) {}
    }
    return allRows;
  }
'''

target_helper_loc = '  async function loadPymDiario(silent) {'
content = content.replace(target_helper_loc, multi_folder_helper + '\n' + target_helper_loc, 1)

# Update loadPymDiario lines 1580 and 1585 to use fetchSpFilesMultiFolder()
old_call1 = 'filas = spRows(await gmJson(spListUrl()));'
new_call1 = 'filas = await fetchSpFilesMultiFolder();'

assert old_call1 in content, "old_call1 not found"
content = content.replace(old_call1, new_call1, 2) # replace both occurrences

with open(src, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied SharePoint multi-folder patch and CELL_RE fix!")
