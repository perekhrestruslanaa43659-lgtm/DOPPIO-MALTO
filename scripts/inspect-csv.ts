
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'Week 8(WEEK 8).csv');

try {
    const content = fs.readFileSync(filePath, 'latin1');
    const lines = content.split(/\r?\n/);
    console.log(`Total lines: ${lines.length}`);

    // Print first 40 lines to capture full header and some data
    for (let i = 0; i < Math.min(lines.length, 40); i++) {
        const line = lines[i].trim();
        // Replace ; with | for visibility
        console.log(`Line ${i}: ${line.replace(/;/g, ' | ')}`);
    }
} catch (e) {
    console.error("Error reading file:", e);
}
