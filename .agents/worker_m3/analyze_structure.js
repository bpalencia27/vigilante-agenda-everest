const fs = require('fs');
const content = fs.readFileSync('vigilante_agenda.user.js', 'utf8');
const lines = content.split('\n');

const promptLines = [328, 4411, 5098, 5992];
promptLines.forEach(lineNum => {
    console.log(`=== LINE ${lineNum} CONTEXT ===`);
    const start = Math.max(0, lineNum - 15);
    const end = Math.min(lines.length, lineNum + 20);
    for (let i = start; i < end; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
});
