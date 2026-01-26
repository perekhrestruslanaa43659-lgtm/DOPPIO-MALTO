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
    console.log('Fetching staff...');
    const staffList = await prisma.staff.findMany();
    console.log(`Found ${staffList.length} staff.`);

    let updated = 0;

    for (const s of staffList) {
        let raw = s.postazioni;
        if (!raw) raw = "[]";

        let parsed: string[] = [];
        try {
            if (raw.trim().startsWith('[')) {
                parsed = JSON.parse(raw);
            } else {
                parsed = [raw];
            }
        } catch (e) {
            console.log(`Failed to parse postazioni for ${s.nome} (${raw}), treating as string.`);
            parsed = [raw]; // Treat as raw string
        }

        if (!Array.isArray(parsed)) parsed = [String(parsed)];

        const cleanedSet = new Set<string>();

        parsed.forEach((item) => {
            // Clean individual item
            let str = String(item).replace(/[\{\}\[\]\(\)\"]/g, ' ');
            // Split delimiters
            const parts = str.split(/[,;\.\n\r]+/).map(x => x.trim().toUpperCase()).filter(x => x.length > 1);

            parts.forEach(p => {
                if (p.includes('NUOVA...')) return;
                let fp = p;
                if (fp === 'BARSU') fp = 'BAR SU';
                if (fp === 'BARGIU') fp = "BAR GIU'";
                cleanedSet.add(fp);
            });
        });

        const newArr = Array.from(cleanedSet).sort();
        const newJson = JSON.stringify(newArr);

        if (newJson !== s.postazioni) {
            console.log(`Updating ${s.nome}: ${s.postazioni} -> ${newJson}`);
            try {
                await prisma.staff.update({
                    where: { id: s.id },
                    data: { postazioni: newJson }
                });
                updated++;
            } catch (err) {
                console.error(`Failed update DB for ${s.nome}:`, err);
            }
        }
    }
    console.log(`Done. Updated ${updated} staff.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
