module.exports = {
  nombre: "Utilidades Puras",
  cubre: ["calcDateRangeAroundIso", "mapConLimite"],
  async pruebas(t, api) {
    await t.casoAsync("calcDateRangeAroundIso: calcula el rango a partir de una fecha base", async () => {
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

    await t.casoAsync("calcDateRangeAroundIso: cruza fin de mes y salta fines de semana", async () => {
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

    await t.casoAsync("calcDateRangeAroundIso: cruza fin de año y salta fines de semana", async () => {
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

    await t.casoAsync("mapConLimite: nunca mantiene más de `limite` promesas en vuelo (18 tareas, límite 5)", async () => {
      const total = 18;
      const limite = 5;
      const items = Array.from({ length: total }, (_, i) => i);
      // Promesas DIFERIDAS a propósito: si `fn` resolviera de forma síncrona/inmediata,
      // la concurrencia nunca se acumularía y el máximo observado sería 1, no 5 — la
      // única forma de medir el tope real es guardar los `resolve` y dispararlos a mano.
      const resolutores = [];
      let enVuelo = 0;
      let maxVuelo = 0;
      const fn = () => new Promise((resolve) => {
        enVuelo++;
        maxVuelo = Math.max(maxVuelo, enVuelo);
        resolutores.push(() => { enVuelo--; resolve(true); });
      });

      const prometido = api.mapConLimite(items, limite, fn);
      t.igual(resolutores.length, limite, "Deben arrancar exactamente `limite` (5) tareas de entrada, ni una más");

      let vueltas = 0;
      while (resolutores.length > 0 && vueltas < total + 5) {
        vueltas++;
        const lote = resolutores.splice(0, resolutores.length);
        lote.forEach((r) => r());
        await new Promise((r) => setTimeout(r, 0));
      }
      const res = await prometido;

      t.igual(maxVuelo, limite, "El máximo de tareas en vuelo observado debe ser EXACTAMENTE el límite (5), nunca 6");
      t.igual(res.length, total, "Debe devolver un resultado por cada tarea de entrada");
      t.cierto(res.every((r) => r.ok === true), "Con esta `fn` (nunca rechaza) todos los resultados deben venir ok:true");
    });

    await t.casoAsync("mapConLimite: los resultados respetan el orden de entrada aunque las tareas terminen desordenadas", async () => {
      const items = ["a", "b", "c", "d"];
      const resolutores = {};
      const fn = (item, idx) => new Promise((resolve) => {
        resolutores[idx] = () => resolve(item.toUpperCase());
      });

      // límite >= items.length: las 4 tareas arrancan a la vez, como Promise.all
      const prometido = api.mapConLimite(items, items.length, fn);

      // Se resuelven a propósito en orden invertido al de llegada
      resolutores[3](); await new Promise((r) => setTimeout(r, 0));
      resolutores[1](); await new Promise((r) => setTimeout(r, 0));
      resolutores[2](); await new Promise((r) => setTimeout(r, 0));
      resolutores[0](); await new Promise((r) => setTimeout(r, 0));

      const res = await prometido;
      t.igual(res.map((r) => r.valor), ["A", "B", "C", "D"], "El array de resultados debe seguir el orden de `items`, no el de finalización");
    });

    await t.casoAsync("mapConLimite: lista vacía devuelve [] sin invocar `fn`", async () => {
      let llamadas = 0;
      const res = await api.mapConLimite([], 5, async () => { llamadas++; return 1; });
      t.igual(res, [], "Debe devolver un array vacío");
      t.igual(llamadas, 0, "No debe invocar `fn` ni una sola vez con lista vacía");
    });

    await t.casoAsync("mapConLimite: una tarea que rechaza no tumba el resto del lote", async () => {
      const items = [1, 2, 3];
      const res = await api.mapConLimite(items, 2, async (x) => {
        if (x === 2) throw new Error("falla-2");
        return x * 10;
      });

      t.igual(res.length, 3, "El lote completo debe devolver 3 resultados aunque uno rechace");
      t.cierto(res[0].ok === true && res[0].valor === 10, "El primer resultado debe resolverse con normalidad");
      t.falso(res[1].ok, "El segundo resultado debe marcarse como fallido, no propagar el rechazo");
      t.cierto(res[1].error instanceof Error && res[1].error.message === "falla-2", "El error real debe quedar accesible en .error");
      t.cierto(res[2].ok === true && res[2].valor === 30, "El tercer resultado debe resolverse con normalidad pese al fallo del segundo");
    });

    await t.casoAsync("mapConLimite: una `fn` que lanza de forma síncrona también da {ok:false} sin tumbar el lote", async () => {
      const res = await api.mapConLimite([1, 2], 2, (x) => {
        if (x === 1) throw new Error("sync-boom"); // lanza ANTES de devolver cualquier promesa
        return Promise.resolve(x);
      });

      t.falso(res[0].ok, "La tarea que lanzó de forma síncrona debe quedar como fallida, no propagar la excepción");
      t.cierto(res[0].error instanceof Error && res[0].error.message === "sync-boom", "El error síncrono debe quedar accesible en .error");
      t.cierto(res[1].ok === true && res[1].valor === 2, "La otra tarea del lote debe resolverse con normalidad");
    });

    await t.casoAsync("mapConLimite: `cancelado` detiene el arranque de tareas nuevas a mitad de lote", async () => {
      const items = [1, 2, 3, 4, 5, 6];
      let cancelar = false;
      const resolutores = [];
      const fn = (x) => new Promise((resolve) => resolutores.push(() => resolve(x * 100)));

      const prometido = api.mapConLimite(items, 2, fn, () => cancelar);
      t.igual(resolutores.length, 2, "Deben estar en vuelo las 2 primeras tareas (límite=2) antes de cancelar");

      cancelar = true;
      resolutores.forEach((r) => r());
      const res = await prometido;

      t.cierto(res[0].ok === true && res[0].valor === 100, "La 1ª tarea ya en vuelo antes de cancelar debe completarse con normalidad, no cortarse a medias");
      t.cierto(res[1].ok === true && res[1].valor === 200, "La 2ª tarea ya en vuelo antes de cancelar debe completarse con normalidad, no cortarse a medias");
      for (let i = 2; i < items.length; i++) {
        t.falso(res[i].ok, "La tarea índice " + i + " no debía arrancar tras la cancelación");
        t.cierto(res[i].cancelado === true, "La tarea índice " + i + " debe quedar marcada como {ok:false, cancelado:true}");
      }
    });

    await t.casoAsync("mapConLimite: `limite` <= 0 se trata como 1, nunca como ilimitado", async () => {
      let enVuelo = 0;
      let maxVuelo = 0;
      const fn = async (x) => {
        enVuelo++;
        maxVuelo = Math.max(maxVuelo, enVuelo);
        await new Promise((r) => setTimeout(r, 1));
        enVuelo--;
        return x;
      };

      const res = await api.mapConLimite([1, 2, 3], 0, fn);
      t.igual(maxVuelo, 1, "Con límite 0 nunca debe haber más de 1 tarea en vuelo a la vez (no debe tratarse como ilimitado)");
      t.igual(res.map((r) => r.valor), [1, 2, 3], "Debe seguir devolviendo todos los resultados en orden con límite 0");

      maxVuelo = 0;
      const res2 = await api.mapConLimite([1, 2, 3], -3, fn);
      t.igual(maxVuelo, 1, "Con límite negativo (-3) tampoco debe superar 1 tarea en vuelo a la vez");
      t.igual(res2.map((r) => r.valor), [1, 2, 3], "Un límite negativo también debe tratarse como 1, no lanzar ni bloquearse");
    });
  }
};
