// ==UserScript==
// @name         Everest Telemetry Logger (Pro)
// @namespace    vigilante-agenda-everest
// @version      2.5.0
// @description  Caja negra avanzada para registrar API calls, navegación y clics en Everest, SharePoint, Athenea, AppCita y Atril Digiturno.
// @author       bpalencia27
// @match        *://neps.everestintelligent.com/*
// @match        *://*.everestintelligent.com/*
// @match        *://*.sharepoint.com/*
// @match        *://*.atheneasoluciones.com/*
// @match        *://appcita.viva1a.com.co/*
// @match        *://*.viva1a.com.co/*
// @match        *://api.digiturno.viva1a.com.co:85/*
// @match        *://api.digiturno.viva1a.com.co:90/*
// @match        *://*.digiturno.viva1a.com.co*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const TELEMETRY = {
        sessionStart: new Date().toISOString(),
        navigation: [],
        network: [],
        clicks: [],
        logs: []
    };

    const TRUNCATE_LIMIT = 50000;

    function logNav(type, url) {
        TELEMETRY.navigation.push({ t: new Date().toISOString(), type, url });
    }
    
    logNav('initial_load', window.location.href);
    window.addEventListener('popstate', () => logNav('popstate', window.location.href));
    window.addEventListener('hashchange', () => logNav('hashchange', window.location.href));
    
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
        logNav('pushState', args[2] || window.location.href);
        return originalPushState.apply(this, args);
    };

    // Interceptor Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const reqTime = new Date().toISOString();
        let url = "", method = "GET", body = null;

        try {
            if (typeof args[0] === "string") url = args[0];
            else if (args[0] && args[0].url) url = args[0].url;
            if (args[1]) {
                method = args[1].method || "GET";
                body = args[1].body;
            }
        } catch (e) {}

        return originalFetch.apply(this, args).then(async (response) => {
            try {
                if (!url.match(/\.(png|jpg|jpeg|gif|css|woff|woff2|ttf|svg|ico)$/i)) {
                    const clone = response.clone();
                    const resText = await clone.text();
                    TELEMETRY.network.push({
                        type: 'fetch',
                        t: reqTime,
                        method,
                        url,
                        reqBody: body,
                        status: response.status,
                        resBody: resText.length > TRUNCATE_LIMIT ? resText.substring(0, TRUNCATE_LIMIT) + "...[TRUNC]" : resText
                    });
                }
            } catch (e) {}
            return response;
        }).catch(err => {
            TELEMETRY.network.push({ type: 'fetch_error', t: reqTime, url, error: String(err) });
            throw err;
        });
    };

    // Interceptor XHR
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._reqMethod = method;
        this._reqUrl = url;
        this._reqTime = new Date().toISOString();
        return originalOpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function(body) {
        this._reqBody = body;
        this.addEventListener('load', function() {
            try {
                const url = this._reqUrl || "";
                if (!url.match(/\.(png|jpg|jpeg|gif|css|woff|woff2|ttf|svg|ico)$/i)) {
                    const resText = this.responseText || "";
                    TELEMETRY.network.push({
                        type: 'xhr',
                        t: this._reqTime,
                        method: this._reqMethod,
                        url,
                        reqBody: typeof body === 'string' ? body : "Blob/FormData",
                        status: this.status,
                        resBody: resText.length > TRUNCATE_LIMIT ? resText.substring(0, TRUNCATE_LIMIT) + "...[TRUNC]" : resText
                    });
                }
            } catch (e) {}
        });
        return originalSend.apply(this, [body]);
    };

    // Observador de Clics
    document.addEventListener("click", function(e) {
        try {
            const target = e.target;
            const el = target.closest('button, a, input, select, .btn, [role="button"], li, td');
            if (el || target) {
                const targetEl = el || target;
                const text = (targetEl.innerText || targetEl.value || targetEl.title || targetEl.placeholder || "").trim().substring(0, 100);
                const id = targetEl.id ? `#${targetEl.id}` : "";
                const cls = targetEl.className ? `.${String(targetEl.className).replace(/\s+/g, ".")}` : "";
                
                if (text || id) {
                    TELEMETRY.clicks.push({
                        t: new Date().toISOString(),
                        tag: targetEl.tagName.toLowerCase() + id + cls,
                        text: text.replace(/\n/g, ' ')
                    });
                }
            }
        } catch (err) {}
    }, true);

    // Botón de Exportación
    window.addEventListener("DOMContentLoaded", () => {
        const btn = document.createElement("button");
        btn.innerHTML = "💾 Bajar Telemetría (Pro)";
        btn.title = "Exportar el comportamiento completo";
        btn.style.cssText = "position:fixed;bottom:15px;left:15px;z-index:9999999;background:#e54d42;color:white;border:none;padding:10px 14px;border-radius:6px;font-family:sans-serif;font-size:12px;font-weight:bold;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.5);opacity:0.9;transition:opacity 0.2s;";
        
        btn.onmouseover = () => btn.style.opacity = "1";
        btn.onmouseout = () => btn.style.opacity = "0.9";
        
        btn.onclick = () => {
            if (TELEMETRY.network.length === 0 && TELEMETRY.clicks.length === 0) {
                alert("Aún no hay datos grabados. Navega por la página primero.");
                return;
            }

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(TELEMETRY, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            
            const now = new Date();
            const dateStr = now.getFullYear() + 
                String(now.getMonth()+1).padStart(2,'0') + 
                String(now.getDate()).padStart(2,'0') + "_" + 
                String(now.getHours()).padStart(2,'0') + 
                String(now.getMinutes()).padStart(2,'0');
            
            downloadAnchorNode.setAttribute("download", `everest_telemetry_PRO_${dateStr}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            const resumen = `✅ Telemetría PRO exportada.\n` +
                            `- Red: ${TELEMETRY.network.length}\n` +
                            `- Clics: ${TELEMETRY.clicks.length}\n` +
                            `- Navegación: ${TELEMETRY.navigation.length}`;
            
            TELEMETRY.network = [];
            TELEMETRY.clicks = [];
            TELEMETRY.navigation = [];
            TELEMETRY.logs = [];
            
            alert(resumen);
        };
        document.body.appendChild(btn);
    });

})();
