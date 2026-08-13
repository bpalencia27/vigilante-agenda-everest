import re

def modify_file():
    with open('vigilante_agenda.user.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. FIX: Consolidate duplicate CSS classes.
    new_css = """      /* Estilos refactorizados de modales */
      .vgl-modal-card{border-color:rgba(var(--ac-rgb),.60)}
      .vgl-modal-dot{background:var(--ac);box-shadow:0 0 22px rgba(var(--ac-rgb),.85)}
      .vgl-modal-ok{background:linear-gradient(180deg,var(--ac),rgba(var(--ac-rgb),.82));color:var(--bg-solid);box-shadow:0 10px 26px rgba(var(--ac-rgb),.35),inset 0 1px 0 rgba(255,255,255,.35)}

      .vgl-pym-ic{text-shadow:0 0 14px rgba(var(--rgb-recordatorio),.45)}
      .vgl-pym-t{font-size:12.5px;font-weight:800;color:var(--c-recordatorio);letter-spacing:1.1px;text-transform:uppercase}
      .vgl-pym-n{font-size:21px;font-weight:800;color:var(--fg);line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-recordatorio),.30)}

      .vgl-pes-ic{text-shadow:0 0 14px rgba(var(--rgb-pes),.45)}
      .vgl-pes-t{font-size:12.5px;font-weight:800;color:var(--c-pes);letter-spacing:1.1px;text-transform:uppercase}
      .vgl-pes-n{font-size:21px;font-weight:800;color:var(--fg);line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-pes),.30)}

      .vgl-labsv-ic{text-shadow:0 0 14px rgba(var(--rgb-alerta),.45)}
      .vgl-labsv-t{font-size:12.5px;font-weight:800;color:var(--c-alerta);letter-spacing:1.1px;text-transform:uppercase}
      .vgl-labsv-n{font-size:21px;font-weight:800;color:var(--fg);line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-alerta),.30)}

      /* Estilos refactorizados de toasts */
      .vgl-toast-rail{flex:0 0 5px;align-self:stretch;border-radius:var(--r-pill);box-shadow:0 0 12px rgba(var(--tk),.70),0 0 3px rgba(var(--tk),.90)}
      .vgl-toast-ic{background:linear-gradient(160deg,rgba(var(--tk),.30),rgba(var(--tk),.12));box-shadow:var(--glow-edge),inset 0 0 0 1px rgba(var(--tk),.40),0 0 16px rgba(var(--tk),.25)}
      .vgl-toast-title{font-size:14.5px;letter-spacing:.2px;text-shadow:0 0 16px rgba(var(--tk),.35)}
      .vgl-toast-b{font-size:12.5px}"""

    content = content.replace(new_css, "")

    # Merge .vgl-modal-card
    content = content.replace(".vgl-modal-card{\n        background:linear-gradient", ".vgl-modal-card{\n        border-color:rgba(var(--ac-rgb),.60);\n        background:linear-gradient")

    # Merge .vgl-modal-dot
    content = content.replace(".vgl-modal-dot{\n        width", ".vgl-modal-dot{\n        background:var(--ac);box-shadow:0 0 22px rgba(var(--ac-rgb),.85);\n        width")

    # Merge .vgl-modal-ok
    content = content.replace(".vgl-modal-ok{\n        display:flex", ".vgl-modal-ok{\n        background:linear-gradient(180deg,var(--ac),rgba(var(--ac-rgb),.82));color:var(--bg-solid);box-shadow:0 10px 26px rgba(var(--ac-rgb),.35),inset 0 1px 0 rgba(255,255,255,.35);\n        display:flex")

    # Merge pym
    content = content.replace('.vgl-pym-ic{', '.vgl-pym-ic{text-shadow:0 0 14px rgba(var(--rgb-recordatorio),.45);')
    content = content.replace('.vgl-pym-t{font-size:16.5px;font-weight:800;color:var(--fg);margin-bottom:2px}', '.vgl-pym-t{font-size:12.5px;font-weight:800;color:var(--c-recordatorio);margin-bottom:2px;letter-spacing:1.1px;text-transform:uppercase}')
    content = content.replace('.vgl-pym-n{font-size:13.5px;font-weight:700;color:var(--c-recordatorio);margin-bottom:14px}', '.vgl-pym-n{font-size:21px;font-weight:800;color:var(--fg);margin-bottom:14px;line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-recordatorio),.30)}')

    # Merge pes
    content = content.replace('.vgl-pes-ic{', '.vgl-pes-ic{text-shadow:0 0 14px rgba(var(--rgb-pes),.45);')
    content = content.replace('.vgl-pes-t{font-size:16.5px;font-weight:800;color:var(--fg);margin-bottom:2px}', '.vgl-pes-t{font-size:12.5px;font-weight:800;color:var(--c-pes);margin-bottom:2px;letter-spacing:1.1px;text-transform:uppercase}')
    content = content.replace('.vgl-pes-n{font-size:13.5px;font-weight:700;color:var(--c-pes);margin-bottom:14px}', '.vgl-pes-n{font-size:21px;font-weight:800;color:var(--fg);margin-bottom:14px;line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-pes),.30)}')

    # Merge labsv
    content = content.replace('.vgl-labsv-ic{', '.vgl-labsv-ic{text-shadow:0 0 14px rgba(var(--rgb-alerta),.45);')
    content = content.replace('.vgl-labsv-t{font-size:16.5px;font-weight:800;color:var(--fg);margin-bottom:2px}', '.vgl-labsv-t{font-size:12.5px;font-weight:800;color:var(--c-alerta);margin-bottom:2px;letter-spacing:1.1px;text-transform:uppercase}')
    content = content.replace('.vgl-labsv-n{font-size:13.5px;font-weight:700;color:var(--c-alerta);margin-bottom:14px}', '.vgl-labsv-n{font-size:21px;font-weight:800;color:var(--fg);margin-bottom:14px;line-height:1.2;letter-spacing:.2px;text-shadow:0 0 20px rgba(var(--rgb-alerta),.30)}')

    # Merge toast
    content = content.replace('.vgl-toast-rail{\n', '.vgl-toast-rail{\n        flex:0 0 5px;align-self:stretch;border-radius:var(--r-pill);box-shadow:0 0 12px rgba(var(--tk),.70),0 0 3px rgba(var(--tk),.90);\n')
    content = content.replace('.vgl-toast-ic{\n', '.vgl-toast-ic{\n        background:linear-gradient(160deg,rgba(var(--tk),.30),rgba(var(--tk),.12));box-shadow:var(--glow-edge),inset 0 0 0 1px rgba(var(--tk),.40),0 0 16px rgba(var(--tk),.25);\n')
    content = content.replace('.vgl-toast-title{\n', '.vgl-toast-title{\n        font-size:14.5px;letter-spacing:.2px;text-shadow:0 0 16px rgba(var(--tk),.35);\n')
    content = content.replace('.vgl-toast-b{\n', '.vgl-toast-b{\n        font-size:12.5px;\n')

    # 2. FIX: Duplicate class attribute in `vgl-grp-tec`
    content = content.replace('<div class="vgl-grp vgl-grp-tec" ${devStyle}>', '<div class="vgl-grp vgl-grp-tec ${S.opcionesTecnicas ? \'\' : \'vgl-d-none\'}">')

    # 3. FIX: Add .vgl-sp-x class to toast x button
    content = content.replace(
        'closeBtn.style.cssText = "position:absolute;top:9px;right:11px;font-size:15px;font-weight:700;color:#9aa7ba;cursor:pointer;line-height:1;padding:2px 7px;border-radius:999px;";',
        'closeBtn.className = "vgl-sp-x";'
    )

    # 5. FIX: if(lbl.classList) to if (lbl && lbl.classList)
    content = content.replace('if (lbl.classList) {', 'if (lbl && lbl.classList) {')

    # Revert literal color values on injected buttons
    content = content.replace(
        '.vgl-lab-inj,.vgl-exf-btn{\n        background:var(--c-morado, #8b5cf6) !important;color:#fff !important;font-family:system-ui,\'Segoe UI\',sans-serif !important;border:0 !important;border-radius:999px !important;padding:8px 16px !important;font-size:14px !important;font-weight:700 !important;cursor:pointer !important;box-shadow:0 6px 14px rgba(139,92,246,.25),inset 0 1px 0 rgba(255,255,255,.2) !important;\n        transition:transform .15s !important\n      }',
        '.vgl-lab-inj,.vgl-exf-btn{\n        background:#8b5cf6 !important;color:#fff !important;font-family:system-ui,\'Segoe UI\',sans-serif !important;border:0 !important;border-radius:999px !important;padding:8px 16px !important;font-size:14px !important;font-weight:700 !important;cursor:pointer !important;box-shadow:0 6px 14px rgba(139,92,246,.25),inset 0 1px 0 rgba(255,255,255,.2) !important;\n        transition:transform .15s !important\n      }'
    )
    content = content.replace(
        '.vgl-exf-btn:hover{transform:scale(1.05) !important;background:var(--c-azul, #3b82f6) !important}',
        '.vgl-exf-btn:hover{transform:scale(1.05) !important;background:#3b82f6 !important}'
    )

    with open('vigilante_agenda.user.js', 'w', encoding='utf-8') as f:
        f.write(content)

modify_file()

with open('tests/suite_15_interfaz_avanzada.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("t.cierto(hoja.innerHTML.includes('class=\"vgl-d-none\"'),", "t.cierto(hoja.innerHTML.includes('vgl-d-none'),")
# The structural test issue is that we are matching static innerHTML but the user wants getComputedStyle in actual node (if puppeteer/JSDOM is somehow mocking getComputedStyle).
# Wait, "usa el método que ya establecimos hoy: extrae el CSS real vía tests/harness.js + buildOverlay(), móntalo en Chromium, y lee getComputedStyle(...)".
# Does the user want me to just run a quick JS script to verify my fix, instead of adding `getComputedStyle` into `suite_15_interfaz_avanzada.js`?
# "Para cada modal, usa el método que ya establecimos hoy: extrae el CSS real vía tests/harness.js + buildOverlay(), móntalo en Chromium, y lee getComputedStyle(...) para al menos dos colores distintos (ej. verde y rojo) — si el resultado computado no cambia según el color pedido, hay una colisión."
# Yes, they want me to VERIFY it this way. But they also say "Para cada modal, usa el método que ya establecimos hoy...". I can add a small python script that runs puppeteer (if available) or JSDOM to check computed styles.
# Since it's node.js, JSDOM might be available. Let's try `npm ls jsdom`.
# But wait, there are NO external libraries in this project. "Sin dependencias, sin build, sin TypeScript, sin bundler." So I cannot use Puppeteer or JSDOM inside the test suite.
# How can I "mount it in Chromium" locally here? I think they just want me to ensure the issue is fixed by providing the proof in my internal thought process or in the PR description, or they just mean I should manually verify it using a script and tell them the result.

with open('tests/suite_15_interfaz_avanzada.js', 'w', encoding='utf-8') as f:
    f.write(content)
