module.exports = {
  nombre: "Utilidades Puras",
  cubre: ["calcDateRangeAroundIso"],
  pruebas(t, api) {
    t.caso("calcDateRangeAroundIso: calcula el rango a partir de una fecha base", () => {
      // Un caso normal a mitad de mes (jueves 16 de mayo 2024 para evitar fines de semana si es posible)
      const baseIso = "2024-05-16";
      const rango = api.calcDateRangeAroundIso(baseIso, 2);

      t.igual(rango.length, 5, "Debe tener 2 días hábiles antes, 1 centro y 2 días hábiles después (5 total)");

      const centro = rango.find(r => r.isCenter);
      t.cierto(centro, "Debe haber un día central");
      t.igual(centro.iso, "2024-05-16", "El día central debe coincidir con la fecha dada");

      // Chequear bordes del rango (saltando el fin de semana si aplica)
      // 16 es Jueves. -1 es 15, -2 es 14.
      t.igual(rango[0].iso, "2024-05-14", "El primer día debe ser el 14 de mayo");
      // +1 es 17, +2 es fin de semana (18, 19), así que debería ser el 20 (lunes).
      t.igual(rango[4].iso, "2024-05-20", "El último día debe saltar el fin de semana y ser el 20 de mayo");
    });

    t.caso("calcDateRangeAroundIso: cruza fin de mes y salta fines de semana", () => {
      // Fin de mes en año bisiesto. 28 de feb 2024 fue miércoles.
      const baseIso = "2024-02-28";
      const rango = api.calcDateRangeAroundIso(baseIso, 3);

      t.igual(rango.length, 7, "Debe tener 3 días antes, 1 centro y 3 días después (7 total)");

      // -1 = 27 (mar), -2 = 26 (lun), -3 = 23 (vie) porque 24/25 son finde.
      t.igual(rango[0].iso, "2024-02-23", "El primer día debe saltar el fin de semana al 23 de feb");
      t.igual(rango[3].iso, "2024-02-28", "El día central debe ser el 28 de feb");

      // +1 = 29 (jue), +2 = 1 mar (vie), +3 = 4 mar (lun, porque 2/3 son finde).
      t.igual(rango[4].iso, "2024-02-29", "El día siguiente al centro debe ser el 29 de feb (año bisiesto)");
      t.igual(rango[5].iso, "2024-03-01", "Cruza a marzo el día 1");
      t.igual(rango[6].iso, "2024-03-04", "El último día debe saltar al 4 de marzo");
    });

    t.caso("calcDateRangeAroundIso: cruza fin de año y salta fines de semana", () => {
      // 31 de diciembre 2024 es Martes.
      const baseIso = "2024-12-31";
      const rango = api.calcDateRangeAroundIso(baseIso, 2);

      t.igual(rango.length, 5, "Debe tener 5 días en total");

      // -1 = 30 (lun), -2 = 27 (vie)
      t.igual(rango[0].iso, "2024-12-27", "Inicia el 27 de diciembre");
      t.igual(rango[2].iso, "2024-12-31", "Centro es fin de año");

      // +1 = 1 (mie), +2 = 2 (jue)
      t.igual(rango[3].iso, "2025-01-01", "Día siguiente es año nuevo");
      t.igual(rango[4].iso, "2025-01-02", "Último día es 2 de enero");
    });
  }
};
