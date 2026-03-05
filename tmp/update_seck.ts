
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const seck = await prisma.staff.findFirst({
        where: {
            nome: { contains: 'Seck', mode: 'insensitive' },
            cognome: { contains: 'Codou', mode: 'insensitive' }
        }
    });

    if (seck) {
        console.log(`Found Seck Codou (ID: ${seck.id}). Current weight: ${seck.productivityWeight}`);
        const updated = await prisma.staff.update({
            where: { id: seck.id },
            data: { productivityWeight: 0.5 }
        });
        console.log(`Updated productivityWeight to: ${updated.productivityWeight}`);
    } else {
        console.log('Seck Codou not found.');
        const allStaff = await prisma.staff.findMany({ select: { id: true, nome: true, cognome: true } });
        console.log('Available staff:', allStaff);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
