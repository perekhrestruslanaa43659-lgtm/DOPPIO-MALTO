const fs = require('fs');
const path = require('path');

try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                if (key && !process.env[key]) {
                    process.env[key] = val;
                }
            }
        }
    }
} catch (e) { console.log('Env load failed', e); }

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const staff = await prisma.staff.findMany();
    const stationCounts: Record<string, number> = {};

    staff.forEach(s => {
        let list = [];
        try {
            if (s.postazioni && s.postazioni.startsWith('[')) list = JSON.parse(s.postazioni);
            else if (s.postazioni) list = [s.postazioni];
        } catch { list = [s.postazioni]; }

        if (!Array.isArray(list)) list = [String(list)];

        list.forEach(p => {
            const clean = String(p);
            stationCounts[clean] = (stationCounts[clean] || 0) + 1;
        });
    });

    console.log('--- STATION COUNTS ---');
    Object.entries(stationCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([k, v]) => console.log(`"${k}": ${v}`));

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
