import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find Karam
    const karam = await prisma.staff.findFirst({
        where: {
            OR: [
                { nome: { contains: 'karam', mode: 'insensitive' } },
                { cognome: { contains: 'karam', mode: 'insensitive' } }
            ]
        }
    });

    if (!karam) {
        console.error('❌ Nessun dipendente di nome Karam trovato!');
        // List all staff to help debug
        const allStaff = await prisma.staff.findMany({ select: { id: true, nome: true, cognome: true, email: true } });
        console.log('Staff disponibili:', allStaff);
        process.exit(1);
    }

    console.log(`✅ Trovato: ${karam.nome} ${karam.cognome} (id: ${karam.id}, email attuale: ${karam.email})`);

    // Update Karam's email to link with user@gmail.com
    const updated = await prisma.staff.update({
        where: { id: karam.id },
        data: { email: 'user@gmail.com' }
    });

    console.log(`✅ Email di ${updated.nome} ${updated.cognome} aggiornata a: ${updated.email}`);
    console.log('🔗 Account user@gmail.com ora collegato al dipendente Karam!');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
