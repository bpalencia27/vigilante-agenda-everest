import sys

def main():
    content = open("tests/suite_08_labs_cronicos.js", "r").read()
    if "_evaluarAccionesRenales: crea botones" not in content:
        new_test = """
    // ================= v14.X — Conducta Renal: evaluar acciones =================
    t.casoAsync("_evaluarAccionesRenales: crea botones para exámenes vencidos y respeta el antiduplicado", async () => {
      // Mockear DOM y dependencias
      const modalSec = c.env.doc.createElement("div");
      modalSec.className = "vgl-labs-renal";

      const prevGet = c.api.apiHcObtenerOrdenamientosVigentes;
      const prevPym = c.api.pymCubiertoPorOrdenVigente;

      let ordenesLlamado = false;
      c.api.apiHcObtenerOrdenamientosVigentes = async () => {
        ordenesLlamado = true;
        return [{ cup: { codigo: "903885" }, fechaCreacion: "2026-08-01T00:00:00Z" }]; // Fósforo
      };

      c.api.pymCubiertoPorOrdenVigente = (actividades, ordenes, hoy) => {
         // Fósforo cubierto, el resto no
         return actividades.filter(a => a.id !== "FOSFORO");
      };

      const r = { estadio: "G3b" };
      const todosLabs = []; // Sin laboratorios recientes, todos vencen

      c.api._evaluarAccionesRenales(r, todosLabs, "123", modalSec);

      // Debe crear el contenedor y los botones iniciales ("Comprobando...")
      const accionesDiv = modalSec.querySelector(".vgl-labs-renal-acciones");
      t.cierto(!!accionesDiv, "Se crea el contenedor de acciones");

      const botones = accionesDiv.querySelectorAll("button");
      t.cierto(botones.length > 0, "Se crean botones de acción");
      t.cierto(botones[0].disabled, "Los botones inician deshabilitados");

      // Esperar que resuelva la promesa mockeada
      await new Promise(res => setTimeout(res, 10));

      t.cierto(ordenesLlamado, "Consulta órdenes vigentes para el paciente");

      // Revisar estado final de los botones
      const btnFosforo = Array.from(botones).find(b => b.textContent.includes("Fósforo"));
      t.cierto(!!btnFosforo, "Existe botón para Fósforo");
      t.cierto(btnFosforo.disabled, "Botón de Fósforo queda deshabilitado por estar vigente");
      t.cierto(btnFosforo.textContent.includes("vigente"), "Texto indica que está vigente");

      const btnPth = Array.from(botones).find(b => b.textContent.includes("PTH"));
      t.cierto(!!btnPth, "Existe botón para PTH");
      t.falso(btnPth.disabled, "Botón de PTH queda habilitado");
      t.cierto(btnPth.textContent.includes("Agregar"), "Texto indica que se puede agregar");

      c.api.apiHcObtenerOrdenamientosVigentes = prevGet;
      c.api.pymCubiertoPorOrdenVigente = prevPym;
    });
"""
        content = content.replace("  },\n};", new_test + "\n  },\n};")
        with open("tests/suite_08_labs_cronicos.js", "w") as f:
            f.write(content)

if __name__ == "__main__":
    main()
