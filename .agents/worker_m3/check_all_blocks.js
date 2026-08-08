const fs = require('fs');
const content = fs.readFileSync('vigilante_agenda.user.js', 'utf8');
const lines = content.split('\n');

function printBlock(start, end, blockName) {
    console.log(`==================== ${blockName} (Lines ${start} to ${end}) ====================`);
    for (let i = start - 1; i < end; i++) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}

printBlock(231, 356, "BLOCK 1");
printBlock(4314, 4439, "BLOCK 2");
printBlock(5001, 5126, "BLOCK 3");
printBlock(5895, 6020, "BLOCK 4");
