
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.staff.findMany({
        orderBy: {
            cognome: 'asc',
        },
        select: {
            id: true,
            nome: true,
            cognome: true,
            ruolo: true
        }
    });

    console.log("--- STAFF LIST ---");
    const lines = users.map(u => `${u.nome} ${u.cognome} (${u.ruolo})`);

    const outputPath = path.join(process.cwd(), 'staff_export.txt');
    fs.writeFileSync(outputPath, lines.join('\n'));
    console.log(`Exported ${lines.length} staff to ${outputPath}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
