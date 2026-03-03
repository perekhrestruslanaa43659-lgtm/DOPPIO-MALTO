
import fs from 'fs';

async function dumpSettings() {
    try {
        const res = await fetch('http://localhost:1865/settings/');
        const data = await res.json();
        fs.writeFileSync('cat-settings-dump.json', JSON.stringify(data, null, 2));
        console.log("Dumped settings to cat-settings-dump.json");
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}
dumpSettings();
