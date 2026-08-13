/**
 * SCRIPT DE DIAGNOSTICO: ETIQUETAS DE PACIENTE (FASE 0 - A3)
 *
 * Instrucciones para el médico:
 * 1. Abra Everest y busque a un paciente que tenga DIABETES o HTA+DM.
 * 2. Abra el modal de agendamiento como lo hace normalmente (el Vigilante cargará sus datos).
 * 3. Presione F12 para abrir las herramientas de desarrollador, vaya a la pestaña "Console" (Consola).
 * 4. Copie y pegue todo este bloque de código, y presione Enter.
 * 5. Copie el resultado que aparecerá en pantalla y péguelo en el chat.
 *
 * NOTA: Este script NO imprime ningún dato del paciente (CERO PHI).
 * Solo imprime la forma de la respuesta del sistema y las etiquetas exactas de sus programas,
 * lo cual es necesario para programar el motor de perfiles del Vigilante de Agenda.
 */

(function() {
    console.log("=== INICIANDO DIAGNÓSTICO DE ETIQUETAS (A3) ===");
    console.log("Interceptando peticiones de red para capturar etiquetas...");

    // Interceptar fetch
    const originalFetch = window.fetch;
    window.fetch = async function() {
        const url = arguments[0];

        if (typeof url === 'string' && url.includes("BuscarPacienteDetallado")) {
            console.log("\n[FETCH] Petición a BuscarPacienteDetallado detectada.");
            try {
                const response = await originalFetch.apply(this, arguments);
                const clone = response.clone();
                clone.json().then(data => {
                    analizarEtiquetas(data);
                }).catch(e => {
                    console.log("Error al leer JSON de BuscarPacienteDetallado:", e.message);
                });
                return response;
            } catch (e) {
                return Promise.reject(e);
            }
        }

        return originalFetch.apply(this, arguments);
    };

    // Interceptar XMLHttpRequest (por si la app usa XHR en lugar de fetch)
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.includes("BuscarPacienteDetallado")) {
            console.log("\n[XHR] Petición a BuscarPacienteDetallado detectada.");
            this.addEventListener('load', function() {
                try {
                    const data = JSON.parse(this.responseText);
                    analizarEtiquetas(data);
                } catch (e) {
                    console.log("Error al analizar JSON de BuscarPacienteDetallado:", e.message);
                }
            });
        }
        originalOpen.apply(this, arguments);
    };

    // Función que procesa los datos pero filtra estrictamente cualquier PHI
    function analizarEtiquetas(json) {
        console.log("\n=== RESULTADO DEL DIAGNÓSTICO ===");

        if (!json || !json.data) {
            console.log("La respuesta no tiene la estructura esperada (falta campo 'data').");
            console.log("Forma de las llaves en la raíz:", Object.keys(json || {}));
            return;
        }

        const data = json.data;
        const programas = data.programasPaciente;

        if (!programas) {
            console.log("El paciente NO tiene el campo 'programasPaciente' en la respuesta.");
            console.log("Campos disponibles en la respuesta (sin datos):", Object.keys(data).join(", "));
            return;
        }

        if (!Array.isArray(programas)) {
            console.log("'programasPaciente' existe pero NO es una lista. Es de tipo:", typeof programas);
            return;
        }

        if (programas.length === 0) {
            console.log("'programasPaciente' es una lista vacía. El paciente no tiene programas asignados.");
            return;
        }

        console.log("Se encontraron " + programas.length + " programas asignados al paciente.");
        console.log("\nCADENAS EXACTAS DETECTADAS (Cópielas tal cual para el desarrollador):");
        console.log("-----------------------------------------------------------------");

        programas.forEach((prog, i) => {
            // Solo imprimimos la descripción, el ID y el switch especial, NINGÚN DATO de paciente
            console.log("Programa #" + (i+1) + ":");
            console.log("  - descripcion:        \"" + prog.descripcion + "\"");
            console.log("  - swProgramaEspecial: " + prog.swProgramaEspecial);
            console.log("  - id:                 " + prog.id);
        });
        console.log("-----------------------------------------------------------------");

        console.log("\n(Fin del diagnóstico. Puede seguir operando con normalidad.)");
    }

    console.log("\nEl diagnóstico está corriendo en segundo plano.");
    console.log("Por favor, cambie de paciente o refresque el modal de agendamiento para desencadenar la petición.");
})();
