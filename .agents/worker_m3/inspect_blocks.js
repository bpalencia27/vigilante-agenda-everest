const fs = require('fs');
const content = fs.readFileSync('vigilante_agenda.user.js', 'utf8');
const lines = content.split('\n');

[319, 4402, 5089, 5983].forEach((startLine, idx) => {
    console.log(`\n=== BLOCK ${idx + 1} starting at line ${startLine} ===`);
    for (let i = startLine - 10; i < startLine + 40; i++) {
        if (lines[i] !== undefined) {
            console.log(`${i+1}: ${lines[i]}`);
        }
    }
});
