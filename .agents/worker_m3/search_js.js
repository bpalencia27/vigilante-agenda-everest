const fs = require('fs');
const content = fs.readFileSync('vigilante_agenda.user.js', 'utf8');
const lines = content.split('\n');

function findTerms(terms) {
    terms.forEach(term => {
        console.log(`=== SEARCH FOR: ${term} ===`);
        lines.forEach((line, idx) => {
            if (line.toLowerCase().includes(term.toLowerCase())) {
                console.log(`Line ${idx + 1}: ${line.trim().slice(0, 120)}`);
            }
        });
    });
}

findTerms(['prompt', 'createLabInjectorUI', 'fetchAtheneaLabs', 'extractPacienteAbierto', 'setNgValue', 'buscar_laboratorios']);
