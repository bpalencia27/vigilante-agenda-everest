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

# Update loadPymDiario to iterate over CONFIG.SP.folders if available
old_load_diario = 'const data = await gmJson(spListUrl());'
new_load_diario = '''let data = null;
    const candidateFolders = CONFIG.SP.folders || [CONFIG.SP.folder];
    for (const fld of candidateFolders) {
      try {
        const d = await gmJson(spListUrl(fld));
        if (d && (d.value || (d.d && d.d.results))) {
          const files = spRows(d);
          if (files && files.length && pickTodaysFile(files)) {
            data = d;
            break;
          }
          if (!data) data = d; // Guardar fallback si hay respuesta
        }
      } catch (e) {}
    }'''

assert old_load_diario in content, "old_load_diario target not found"
content = content.replace(old_load_diario, new_load_diario, 1)

with open(src, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated SharePoint folder paths and multi-folder search!")
