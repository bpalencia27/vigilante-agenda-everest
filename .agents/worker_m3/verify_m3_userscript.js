const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const targetPath = path.resolve(__dirname, '../../vigilante_agenda.user.js');

console.log(`[Verification] Validating file: ${targetPath}`);

if (!fs.existsSync(targetPath)) {
    console.error(`❌ Target file not found at ${targetPath}`);
    process.exit(1);
}

const content = fs.readFileSync(targetPath, 'utf8');

let errors = 0;

// Test 1: Node JS Syntax check
try {
    execSync(`node -c "${targetPath}"`, { stdio: 'pipe' });
    console.log('✅ TEST 1 PASSED: JavaScript syntax is valid (node -c).');
} catch (e) {
    console.error('❌ TEST 1 FAILED: JavaScript syntax error:', e.stderr.toString());
    errors++;
}

// Test 2: Check Tampermonkey Header Directives
const headerMatch = content.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
if (!headerMatch) {
    console.error('❌ TEST 2 FAILED: UserScript header block not found.');
    errors++;
} else {
    const header = headerMatch[1];
    const hasGrantXmlHttp = header.includes('@grant        GM_xmlhttpRequest') || header.includes('@grant GM_xmlhttpRequest');
    const hasConnectLocalhost = header.includes('@connect      localhost') || header.includes('@connect localhost');
    const hasConnectIp = header.includes('@connect      127.0.0.1') || header.includes('@connect 127.0.0.1');

    if (hasGrantXmlHttp) console.log('✅ TEST 2a PASSED: @grant GM_xmlhttpRequest present.');
    else { console.error('❌ TEST 2a FAILED: @grant GM_xmlhttpRequest missing.'); errors++; }

    if (hasConnectLocalhost) console.log('✅ TEST 2b PASSED: @connect localhost present.');
    else { console.error('❌ TEST 2b FAILED: @connect localhost missing.'); errors++; }

    if (hasConnectIp) console.log('✅ TEST 2c PASSED: @connect 127.0.0.1 present.');
    else { console.error('❌ TEST 2c FAILED: @connect 127.0.0.1 missing.'); errors++; }
}

// Test 3: Check getAtheneaIdSolicitudAuto function and endpoint hook
if (content.includes('function getAtheneaIdSolicitudAuto')) {
    console.log('✅ TEST 3a PASSED: getAtheneaIdSolicitudAuto function defined.');
} else {
    console.error('❌ TEST 3a FAILED: getAtheneaIdSolicitudAuto function missing.');
    errors++;
}

if (content.includes('http://localhost:5050/api/buscar_laboratorios?documento=')) {
    console.log('✅ TEST 3b PASSED: Correct API Bridge endpoint hook found.');
} else {
    console.error('❌ TEST 3b FAILED: API Bridge endpoint hook missing or incorrect.');
    errors++;
}

// Test 4: Check replacement of prompt in createLabInjectorUI
const promptIdSolicitudMatch = content.includes('prompt("Para inyectar en Ruta Crónicos, ingresa el \'idSolicitud\'');
if (!promptIdSolicitudMatch) {
    console.log('✅ TEST 4 PASSED: Manual prompt() for idSolicitud replaced with automated retrieval.');
} else {
    console.error('❌ TEST 4 FAILED: Manual prompt() for idSolicitud still present in userscript.');
    errors++;
}

// Test 5: Verify status/toast updates in UI
if (content.includes('Buscando idSolicitud en Athenea...') && content.includes('idSolicitud obtenido:')) {
    console.log('✅ TEST 5 PASSED: UI toast/status updates present during auto extraction.');
} else {
    console.error('❌ TEST 5 FAILED: UI toast/status messages missing.');
    errors++;
}

console.log('================================================');
if (errors === 0) {
    console.log('🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
} else {
    console.error(`💥 VERIFICATION FAILED WITH ${errors} ERRORS.`);
    process.exit(1);
}
