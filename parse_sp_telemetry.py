import json

with open(r'C:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\everest_telemetry_PRO_20260808_1010.json', encoding='utf-8') as f:
    data = json.load(f)

for req in data.get("network", []):
    url = req.get("url", "")
    if "RenderListDataAsStream" in url:
        print("\nURL:", url)
        res = req.get("resBody", "")
        if "Agenda" in res or "BELLO" in res or "xlsx" in res:
            print("FOUND EXCEL/AGENDAS IN RESPONSE!")
            try:
                pj = json.loads(res)
                for row in pj.get("Row", []):
                    print(" - File/Folder:", row.get("FileLeafRef"), "| Type:", row.get("FSObjType"), "| RelUrl:", row.get("FileRef"))
            except Exception as e:
                print("Response text sample:", res[:500])
