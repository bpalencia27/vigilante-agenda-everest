const fs = require('fs');
let code = fs.readFileSync('vigilante_agenda.user.js', 'utf8');

// Subir @version a v13.0.0
code = code.replace(/@version\s+12\.6\.9/, '@version         13.0.0');
code = code.replace(/const VERSION = "12\.6\.9";/, 'const VERSION = "13.0.0";');

const changelog = `
// =====================================================================
// CHANGELOG
// =====================================================================
// v13.0.0 (2026-08-12) — Refactorización visual del panel de agendamiento
//   - (Fix) Se refactorizó la ventana de días a ±7 días hábiles + sábados reales sin asumir reglas de calendario.
//   - (Nuevo) Render progresivo del calendario, consultando 16-18 días en concurrencia limitada para evitar castigar la red.
//   - (Nuevo) Motor de perfil clínico independiente (Ejes Franja/Cupos) para diabéticos e hipertensos según etiquetas de Everest.
//   - (UI) Los cupos adicionales de 20m se distinguen con clases CSS propias, igual que la primera mitad de la jornada en DM.
//   - (UI) Atendido se atenúa para distinguirse visualmente de "En sala", sin perder su marca ROJA en caso de fraude.
//   - (Pendiente sin evidencia) Cadenas exactas para las etiquetas de programa; se usarán del script de diagnóstico local.
// ---------------------------------------------------------------------
`;

code = code.replace(/\/\/ =====================================================================\n\/\/ CHANGELOG\n\/\/ =====================================================================\n/, changelog);

fs.writeFileSync('vigilante_agenda.user.js', code);
