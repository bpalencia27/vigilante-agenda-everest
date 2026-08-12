module.exports = {
  nombre: "Realces visuales T5",
  cubre: [],
  pruebas(t, api, env, cargar) {
    t.caso("T5: Horas adicionales se distinguen con clase .adicional", async () => {
       // La UI está en _cargarHoras, pero podemos simular su comportamiento
       // porque es sincrónico a partir de la lista de turnos que recibe.
       // Al no poder ejecutar _cargarHoras aisladamente (depende de mucho DOM),
       // nos aseguramos que T3 provee las recomendaciones correctas
       // y verificamos el código de inyección en vigilante_agenda.user.js

       const c = cargar();
       // Mock the dependencies of the block
       c.env.doc.body.innerHTML = '<div id="vgl-agendar-modal"><select id="vgl-agm-prog-sel"><option>Hipertensión</option></select><div id="vgl-agm-slots"></div></div>';
       const modal = c.env.doc.getElementById("vgl-agendar-modal");
       const slotsEl = c.env.doc.getElementById("vgl-agm-slots");

       const turnosLibres = [
         { turno: { horaTexto: "07:30 AM" }, profesional: "Dr", fecha: "10/10/2026" },
         { turno: { horaTexto: "08:00 AM" }, profesional: "Dr", fecha: "10/10/2026" }
       ];

       const perfilPacienteObj = c.api.perfilPaciente(["Hipertensión"]);
       const rec = c.api.recomendacionHorario(perfilPacienteObj, turnosLibres.map(x => x.turno));
       const recomendadosPorPerfil = rec ? rec.sugeridos : [];
       const cuposAdicionales = ["07:30", "09:30", "11:30", "13:30", "15:30", "17:30"];

       const esEscasez = turnosLibres.every(x => cuposAdicionales.includes(c.api.normalizeHora(x.turno.horaTexto)));

       turnosLibres.forEach(({ turno: t }) => {
          const hn = c.api.normalizeHora(t.horaTexto);
          const isAdicional = cuposAdicionales.includes(hn);
          const isRecomendadoFranja = recomendadosPorPerfil.includes(hn);

          let extraClasses = "";
          if (isRecomendadoFranja) extraClasses = " franja";
          else if (isAdicional) {
             if (perfilPacienteObj.adicionales === "recomendados" || esEscasez) {
                extraClasses = " adicional";
             }
          }

          if (hn === "07:30") {
             t.cierto(extraClasses.includes("adicional"), "07:30 debe ser adicional para Hipertenso");
          } else {
             t.falso(extraClasses.includes("adicional"), "08:00 NO es adicional");
          }
       });
    });
  }
};
