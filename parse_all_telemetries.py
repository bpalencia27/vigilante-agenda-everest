import json
import glob
import os

files = glob.glob(r'C:\Users\viva1a\Desktop\BRANDON\vigilante_agenda\everest_telemetry_PRO_*.json')

print(f"Found {len(files)} telemetry files to analyze.\n")

for fpath in sorted(files):
    fname = os.path.basename(fpath)
    print(f"=======================================================")
    print(f"FILE: {fname}")
    print(f"=======================================================")
    try:
        with open(fpath, encoding='utf-8') as f:
            data = json.load(f)
        
        network = data.get("network", [])
        clicks = data.get("clicks", [])
        nav = data.get("navigation", [])
        print(f"Network items: {len(network)} | Clicks: {len(clicks)} | Nav: {len(nav)}")
        
        endpoints = set()
        for req in network:
            url = req.get("url", "")
            base = url.split("?")[0]
            endpoints.add(f"{req.get('method')} {base}")
            
        for ep in sorted(endpoints):
            print("  -", ep)
            
        print("\n  [Key API calls captured]:")
        for req in network:
            url = req.get("url", "")
            if any(k in url for k in ["Buscar", "Laboratorio", "Ordenamiento", "Guardar", "Ticket", "Citas", "Reporte", "SharePoint", "_api"]):
                print(f"   -> {req.get('method')} {url}")
                if req.get("reqBody"):
                    print("      ReqBody:", str(req.get("reqBody"))[:150])
    except Exception as e:
        print("Error reading file:", str(e))
    print("\n")
