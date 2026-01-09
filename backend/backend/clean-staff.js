// Script per pulire staff con nomi strani dal database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanStaff() {
    try {
        // Trova staff con nomi che contengono caratteri strani
        const allStaff = await prisma.staff.findMany();

        const strangeStaff = allStaff.filter(s => {
            const nome = s.nome || '';
            // Trova righe con | o nomi molto lunghi o che contengono orari
            return nome.includes('|') ||
                nome.length > 50 ||
                nome.includes(':') ||
                nome.includes('SALA') ||
                nome.includes('BARGIU');
        });

        console.log(`Trovati ${strangeStaff.length} staff strani:`);
        strangeStaff.forEach(s => {
            console.log(`  ID: ${s.id}, Nome: ${s.nome.substring(0, 50)}...`);
        });

        if (strangeStaff.length > 0) {
            console.log('\nEliminazione in corso...');
            for (const s of strangeStaff) {
                await prisma.staff.delete({ where: { id: s.id } });
                console.log(`  ✓ Eliminato ID ${s.id}`);
            }
            console.log(`\n✅ Eliminati ${strangeStaff.length} staff strani`);
        } else {
            console.log('\n✅ Nessuno staff strano trovato');
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanStaff();
