// Script per verificare e pulire completamente lo staff
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Lista dei 35 dipendenti validi
const validStaff = [
    'LUCA GNECCO', 'GIULIA BONZI', 'MARIAM HANY', 'PAOLO PALINI',
    'RUSLANA PEREKHREST', 'BANCE MOUSSA', 'ERMANNO BERTAZZONI',
    'ELENA CAVALLO', 'AHMED SALEM', 'ELIAS KARAM', 'DAVID VERMIGLIO',
    'MERAN MOHAMED', 'CHIERICO CHIARA', 'MATTEO MONTELATICI',
    'CELESTE MATHIEU', 'REBECCA GAZZOLA', 'FRANCESCA TACCOLINI',
    'SECK CODOU', 'JENNIFER GAMARRA', 'MAMADOU DIALLO',
    'STEVENS CARZANIGA', 'NETTRA NIRMANI', 'WALID LARJANI',
    'LUCA CORDONATTO', 'ABIR HOSSAIN', 'IMRAN MOLLA',
    'SHOHEL MATUBBER', 'JUBAIR AHMED', 'SAHIDUL ISLAM',
    'SHOAG AHMED', 'BABUL MIAH', 'ADIL AHMED',
    'JAHIDUR RAHMAN', 'SUAB AHMED', 'RUMEL HANNAN'
];

async function cleanAllStaff() {
    try {
        const allStaff = await prisma.staff.findMany();
        console.log(`\nTotale staff nel database: ${allStaff.length}`);

        const toDelete = [];
        const toKeep = [];

        allStaff.forEach(s => {
            const fullName = `${s.nome} ${s.cognome || ''}`.trim().toUpperCase();
            const isValid = validStaff.some(valid =>
                fullName.includes(valid) || valid.includes(fullName)
            );

            if (isValid) {
                toKeep.push(s);
            } else {
                toDelete.push(s);
            }
        });

        console.log(`\n✅ Staff validi da mantenere: ${toKeep.length}`);
        toKeep.forEach(s => console.log(`  - ${s.nome} ${s.cognome || ''}`));

        console.log(`\n❌ Staff da eliminare: ${toDelete.length}`);
        toDelete.forEach(s => {
            const nome = s.nome.length > 50 ? s.nome.substring(0, 50) + '...' : s.nome;
            console.log(`  - ID ${s.id}: ${nome}`);
        });

        if (toDelete.length > 0) {
            console.log('\n🗑️  Eliminazione in corso...');
            for (const s of toDelete) {
                await prisma.staff.delete({ where: { id: s.id } });
            }
            console.log(`\n✅ Eliminati ${toDelete.length} staff non validi`);
            console.log(`✅ Rimangono ${toKeep.length} staff validi`);
        } else {
            console.log('\n✅ Database già pulito!');
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanAllStaff();
