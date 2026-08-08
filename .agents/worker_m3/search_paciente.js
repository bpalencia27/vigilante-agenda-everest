const fs = require('fs');
const content = fs.readFileSync('vigilante_agenda.user.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
    if (line.includes('extractDoc') || line.includes('extractPacienteAbierto')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
