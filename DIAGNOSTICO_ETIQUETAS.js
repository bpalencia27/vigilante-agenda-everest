/**
 * SCRIPT DE DIAGNÓSTICO DE ETIQUETAS RCV
 * ---------------------------------------------------------
 * INSTRUCCIONES PARA EL MÉDICO:
 * 1. Abra el panel de agendamiento de Everest para un paciente
 *    que sepa que tiene alguna de las etiquetas (Hipertensión,
 *    Diabetes, HTA+DM o Nefroprotección).
 * 2. Abra la consola del navegador (F12 -> pestaña Consola).
 * 3. Pegue todo este código y presione Enter.
 * 4. Copie la respuesta generada y compártala. NO SE INCLUYEN
 *    DATOS DEL PACIENTE, SÓLO LAS ETIQUETAS DE LA APLICACIÓN.
 */
(function() {
    console.log("=== INICIANDO DIAGNÓSTICO DE ETIQUETAS ===");

    // Interceptar la llamada a BuscarPacienteDetallado
    const originalFetch = window.fetch;
    window.fetch = async function() {
        const response = await originalFetch.apply(this, arguments);
        const url = arguments[0];

        if (url && typeof url === 'string' && url.includes('BuscarPacienteDetallado')) {
            const clone = response.clone();
            clone.json().then(data => {
                if (data && data.programasPaciente) {
                    console.log(">> CAPTURA EXITOSA DE BuscarPacienteDetallado <<");
                    console.log("Forma de los datos: array de", data.programasPaciente.length, "elementos.");
                    console.log("Cadenas EXACTAS encontradas en 'descripcion':");
                    const etiquetas = data.programasPaciente.map(p => ({
                        id: p.id,
                        descripcion: p.descripcion,
                        swProgramaEspecial: p.swProgramaEspecial
                    }));
                    console.log(JSON.stringify(etiquetas, null, 2));
                    console.log("==========================================");
                    console.log("Por favor, copie y pegue estas líneas en el issue de Github/Gist.");
                } else {
                    console.log("Llamada detectada, pero 'programasPaciente' no está en la respuesta.");
                }
            }).catch(e => {
                console.log("Error leyendo JSON del diagnóstico:", e);
            });
        }

        // Revisar si están en BuscarCitasDisponibles (Capa 1 alternativa)
        if (url && typeof url === 'string' && url.includes('BuscarCitasDisponibles')) {
             const clone = response.clone();
             clone.json().then(data => {
                 let agendas = null;
                 if (data && data.Data) agendas = data.Data;
                 else if (Array.isArray(data)) agendas = data;

                 if (agendas && agendas.length > 0) {
                     // Analizar el primer elemento para ver si las agendas
                     // contienen las etiquetas sin necesidad de hacer BuscarPacienteDetallado
                     const llaves = Object.keys(agendas[0]).filter(k =>
                        typeof agendas[0][k] === 'string' &&
                        (agendas[0][k].toLowerCase().includes('hiper') ||
                         agendas[0][k].toLowerCase().includes('diab') ||
                         agendas[0][k].toLowerCase().includes('nefro'))
                     );

                     if (llaves.length > 0) {
                         console.log(">> ETIQUETA POSIBLEMENTE ENCONTRADA EN BuscarCitasDisponibles <<");
                         console.log("En la clave:", llaves[0], "-> valor:", agendas[0][llaves[0]]);
                     }
                 }
             }).catch(e => {});
        }
        return response;
    };

    console.log("Interceptor instalado. Por favor, haga click en 'Agendar' o cambie de paciente para disparar la consulta.");
})();
