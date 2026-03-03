
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'Week8_User_Paste.txt');

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    console.log(`Total lines: ${lines.length}`);

    // Analyze first few lines
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const line = lines[i];
        const tabCount = (line.match(/\t/g) || []).length;
        const spaceCount = (line.match(/ /g) || []).length;
        console.log(`Line ${i}: Length=${line.length}, Tabs=${tabCount}, Spaces=${spaceCount}`);

        if (line.includes('GIULIA')) {
            console.log(`--- GIULIA ROW [${i}] ---`);
            // Split by tab
            const cols = line.split('\t');
            console.log('TAB SPLIT:', cols.map((c, idx) => `[${idx}]="${c}"`).join(' | '));
        }
    }

} catch (e) {
    console.error(e);
}
