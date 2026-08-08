// ==UserScript==
// @name         Vigilante Centinela (Monitor SRE)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Monitor pasivo ultraligero para detectar rupturas de contrato en Everest.
// @author       SRE
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuración del Webhook
    const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE'; // Reemplazar con webhook real
    const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 horas en ms para revisiones periódicas (DOM)
    
    // Estado interno
    const STATE = {
        lastAlert: {},
        domChecked: false
    };

    // Función para enviar alertas (con throttle para no spamear)
    function reportIssue(type, detail) {
        console.error(`[CENTINELA] Mutación detectada: ${type} - ${detail}`);
        
        const now = Date.now();
        // Evitar spam: solo 1 alerta del mismo tipo cada hora
        if (STATE.lastAlert[type] && (now - STATE.lastAlert[type]) < 3600000) {
            return;
        }
        STATE.lastAlert[type] = now;

        // Construir payload
        const payload = {
            content: `🚨 **ALERTA CENTINELA** 🚨\n**Tipo:** ${type}\n**Detalle:** ${detail}\n**Fecha:** ${new Date().toISOString()}`
        };

        if (WEBHOOK_URL && WEBHOOK_URL !== 'YOUR_WEBHOOK_URL_HERE') {
            try {
                // Usamos GM_xmlhttpRequest para saltar CORS si es necesario, o fetch nativo
                if (typeof GM_xmlhttpRequest !== 'undefined') {
                    GM_xmlhttpRequest({
                        method: "POST",
                        url: WEBHOOK_URL,
                        headers: {
                            "Content-Type": "application/json"
                        },
                        data: JSON.stringify(payload)
                    });
                } else {
                    fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).catch(() => {});
                }
            } catch (e) {
                console.error("[CENTINELA] Error enviando webhook", e);
            }
        }
    }

    // 1. Monitor del DOM (MutationObserver)
    function checkDOM() {
        if (!document.body) return;
        
        const targetSelector = '.labelHora';
        
        // Búsqueda pasiva mediante MutationObserver para interceptar el momento de creación
        const observer = new MutationObserver((mutations) => {
            // El centinela busca pasivamente, sin bloquear el Main Thread
        });
        
        observer.observe(document.body, { childList: true, subtree: true });

        // Verificación periódica heurística
        setInterval(() => {
            // Detectamos si estamos en una vista de agenda que DEBERÍA tener .labelHora
            // Se usa try-catch para no interferir con la SPA bajo ninguna circunstancia
            try {
                const contenedoresAgenda = document.querySelectorAll('.card-body, .agenda-container, [id*="agenda"]'); 
                if (contenedoresAgenda.length > 0) {
                    const labelHoraElements = document.querySelectorAll(targetSelector);
                    if (labelHoraElements.length === 0) {
                        // Posible ruptura de contrato UI
                        reportIssue('DOM_CONTRACT_BROKEN', `Selector crítico '${targetSelector}' no encontrado en la vista actual.`);
                    }
                }
            } catch (e) {}
        }, CHECK_INTERVAL);
    }

    // 2. Interceptor de fetch para validar contrato JSON (antes de que la SPA lo vea)
    function interceptFetch() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
            
            const responsePromise = originalFetch.apply(this, args);
            
            if (url.includes('/ObtenerConsultas') || url.includes('/Turnos')) {
                responsePromise.then(response => {
                    const clone = response.clone();
                    clone.json().then(data => {
                        checkSchema(data, url);
                    }).catch(e => {
                        reportIssue('JSON_PARSE_ERROR', `Error al decodificar JSON de ${url}`);
                    });
                }).catch(e => {
                    // Errores de red ignorados en el centinela
                });
            }
            
            return responsePromise;
        };
    }

    function checkSchema(data, url) {
        // Encontrar la lista de pacientes/turnos
        const list = Array.isArray(data) ? data : (data.consultas || data.data || data.lista || []);
        
        if (!Array.isArray(list)) {
            reportIssue('SCHEMA_BROKEN', `El contrato principal falló: ${url} no contiene un array esperado.`);
            return;
        }

        if (list.length > 0) {
            const sample = list[0];
            // Validar campos críticos según uso en vigilante_agenda.user.js
            const requiredFields = ['id_paciente', 'hora_inicio', 'estado']; 
            
            const missing = requiredFields.filter(f => !(f in sample));
            if (missing.length > 0) {
                reportIssue('SCHEMA_BROKEN', `Faltan propiedades JSON críticas en ${url}: ${missing.join(', ')}`);
            }
        }
    }

    // Inicialización silenciosa
    try {
        interceptFetch();
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkDOM);
        } else {
            checkDOM();
        }
        console.log("[CENTINELA] Monitor SRE inicializado en modo sigilo.");
    } catch (e) {
        // Fallar silenciosamente
    }
})();
