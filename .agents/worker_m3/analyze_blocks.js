const fs = require('fs');
const content = fs.readFileSync('vigilante_agenda.user.js', 'utf8');
const lines = content.split('\n');

function printRange(start, end, label) {
    console.log(`=== ${label} (Lines ${start}-${end}) ===`);
    for (let i = start - 1; i < end; i++) {
        if (lines[i]) {
            console.log(`${i+1}: ${lines[i]}`);
        }
    }
}

// Find where extractPacienteAbierto is defined
lines.forEach((l, idx) => {
    if (l.includes('function extractPacienteAbierto')) {
        printRange(idx - 2, idx + 40, `extractPacienteAbierto at ${idx+1}`);
    }
});
