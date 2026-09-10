// Arma el payload de PATCH del Gist d231aab6f54de51a5c472b392aac1b91.
// Uso: node armar_payload_gist.js <fuente.user.js> <novedades.txt> <salida.json>
const fs = require("fs");
const [,, fuente, novedades, salida] = process.argv;
const src = fs.readFileSync(fuente, "utf8");
const nov = fs.readFileSync(novedades, "utf8");
const payload = {
  description: "Vigilante de Agenda — Everest/Athenea (v18.12.1)",
  files: {
    "gistfile1.txt": { content: src },
    "gistfile2.txt": { content: nov },
    "vigilante_agenda.user.js": { content: src },
  },
};
fs.writeFileSync(salida, JSON.stringify(payload));
console.log("payload listo:", salida, "(" + src.length + " bytes de fuente)");
