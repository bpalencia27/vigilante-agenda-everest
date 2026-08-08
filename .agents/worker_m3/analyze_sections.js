const fs = require('fs');
const content = fs.readFileSync('vigilante_agenda.user.js', 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);
lines.forEach((line, idx) => {
    if (line.startsWith('// ==UserScript==') || 
        line.includes('v7.') || line.includes('v8.') || line.includes('v9.') ||
        line.includes('function createLabInjectorUI') ||
        line.includes('function fetchAtheneaLabs') ||
        line.includes('function getAtheneaIdSolicitudAuto')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
