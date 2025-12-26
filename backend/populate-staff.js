// Script per popolare il database con i 35 dipendenti
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const staff = [
    // Management
    { nome: 'LUCA', cognome: 'GNECCO', email: 'lucagnecco@gmail.com', ruolo: 'RM', oreMin: 40, oreMax: 40, costo: 15, postazioni: '' },
    { nome: 'GIULIA', cognome: 'BONZI', email: 'Giulia.bonzi@gmail.com', ruolo: 'VRM', oreMin: 40, oreMax: 40, costo: 14, postazioni: '' },
    { nome: 'MARIAM', cognome: 'HANY', email: 'mariam@gmail.com', ruolo: 'JM', oreMin: 40, oreMax: 40, costo: 12, postazioni: '' },
    { nome: 'PAOLO', cognome: 'PALINI', email: 'paolo@gmail.com', ruolo: 'JM', oreMin: 40, oreMax: 40, costo: 10, postazioni: '' },

    // Operatori Sala/Bar
    { nome: 'RUSLANA', cognome: 'PEREKHREST', email: 'rusliperekhrest@gmail.com', ruolo: 'in formazione', oreMin: 30, oreMax: 30, costo: 9, postazioni: 'CDR, ACC' },
    { nome: 'BANCE', cognome: 'MOUSSA', email: 'bance@gmail.com', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 8, postazioni: 'PASS' },
    { nome: 'ERMANNO', cognome: 'BERTAZZONI', email: 'ermanno@gmail.com', ruolo: 'L. 68/99', oreMin: 30, oreMax: 30, costo: 6, postazioni: 'B/S' },
    { nome: 'ELENA', cognome: 'CAVALLO', email: 'elena@gmail.com', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 8, postazioni: 'BARGIU, B/S, BARSU, CDR' },
    { nome: 'AHMED', cognome: 'SALEM', email: 'ahmed@gmail.com', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 8, postazioni: 'BARGIU, PASS, B/S, CDR' },
    { nome: 'ELIAS', cognome: 'KARAM', email: 'elias@gmail.com', ruolo: 'OPERATORE', oreMin: 24, oreMax: 24, costo: 8, postazioni: 'B/S, BARGIU, PASS, CDR, BARSU' },
    { nome: 'DAVID', cognome: 'VERMIGLIO', email: 'david@gmail.com', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 8, postazioni: 'B/S, BARSU, CDR' },
    { nome: 'MERAN', cognome: 'MOHAMED', email: 'meran@gmail.com', ruolo: 'OPERATORE', oreMin: 18, oreMax: 18, costo: 8, postazioni: 'BARGIU, CDR, B/S, BARSU' },
    { nome: 'CHIERICO', cognome: 'CHIARA', email: 'chiara@gmail.com', ruolo: 'OPERATORE', oreMin: 24, oreMax: 24, costo: 8, postazioni: 'BARGIU, ACCSU, CDR, PASS' },
    { nome: 'CELESTE', cognome: 'MATHIEU', email: 'celeste@gmail.com', ruolo: 'ACC/OPS', oreMin: 24, oreMax: 24, costo: 8, postazioni: 'ACCGIU' },
    { nome: 'FRANCESCA', cognome: 'TACCOLINI', email: 'francesca@gmail.com', ruolo: 'OPERATORE', oreMin: 15, oreMax: 15, costo: 8, postazioni: 'BARSU' },
    { nome: 'SECK', cognome: 'CODOU', email: 'seck@gmail.com', ruolo: 'OPERATORE', oreMin: 25, oreMax: 25, costo: 8, postazioni: 'BARSU, B/S' },
    { nome: 'WALID', cognome: 'LARJANI', email: 'walid@gmail.com', ruolo: 'OPERATORE', oreMin: 30, oreMax: 30, costo: 6, postazioni: 'CDR, B/S' },

    // Tirocinanti
    { nome: 'JENNIFER', cognome: 'GAMARRA', email: 'jennifer@gmail.com', ruolo: 'TIROCINANTE', oreMin: 20, oreMax: 20, costo: 6, postazioni: 'SCARICO, B/S' },
    { nome: 'MAMADOU', cognome: 'DIALLO', email: 'mamadou@gmail.com', ruolo: 'TIROCINANTE', oreMin: 40, oreMax: 40, costo: 6, postazioni: 'B/S, PASS' },
    { nome: 'STEVENS', cognome: 'CARZANIGA', email: 'stevens@gmail.com', ruolo: 'TIROCINANTE', oreMin: 30, oreMax: 30, costo: 6, postazioni: 'CDR, BARGIU, B/S' },

    // Chiamata
    { nome: 'MATTEO', cognome: 'MONTELATICI', email: 'matteo@gmail.com', ruolo: 'CHIAMATA', oreMin: 0, oreMax: 0, costo: 8, postazioni: 'BARGIU, B/S, CDR' },
    { nome: 'REBECCA', cognome: 'GAZZOLA', email: 'rebecca@gmail.com', ruolo: 'CHIAMATA', oreMin: 0, oreMax: 0, costo: 10, postazioni: 'BARSU, CDR' },
    { nome: 'NETTRA', cognome: 'NIRMANI', email: 'netra@gmail.com', ruolo: 'CHIAMATA', oreMin: 0, oreMax: 0, costo: 10, postazioni: 'CDR, BARGIU, B/S' },
    { nome: 'LUCA', cognome: 'CORDONATTO', email: 'luca@gmail.com', ruolo: 'CHIAMATA', oreMin: 0, oreMax: 0, costo: 10, postazioni: 'B/S' },

    // Cucina (BOH)
    { nome: 'ABIR', cognome: 'HOSSAIN', email: '', ruolo: 'KM', oreMin: 40, oreMax: 40, costo: 12, postazioni: '' },
    { nome: 'IMRAN', cognome: 'MOLLA', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 9, postazioni: 'Pira, Burger, Fritti, Preparazione' },
    { nome: 'SHOHEL', cognome: 'MATUBBER', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 9, postazioni: 'Pira, Burger, Fritti, Preparazione' },
    { nome: 'JUBAIR', cognome: 'AHMED', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 7, postazioni: 'Lavaggio, Fritti, Dolci/Ins' },
    { nome: 'SAHIDUL', cognome: 'ISLAM', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 7, postazioni: 'Burger, Preparazione' },
    { nome: 'SHOAG', cognome: 'AHMED', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 7, postazioni: 'Burger, Preparazione, Lavaggio, Fritti, Dolci/Ins' },
    { nome: 'BABUL', cognome: 'MIAH MD', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 7, postazioni: 'Burger, Preparazione, Fritti, Dolci/Ins, Lavaggio' },
    { nome: 'ADIL', cognome: 'AHMED', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 7, postazioni: 'Pizza, Fritti, Dolci/Ins, Preparazione, Lavaggio' },
    { nome: 'JAHIDUR', cognome: 'RAHMAN', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 7, postazioni: 'Pizza, Fritti, Dolci/Ins, Preparazione, Lavaggio' },
    { nome: 'SUAB', cognome: 'AHMED', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 7, postazioni: 'Burger, Preparazione, Fritti, Dolci/Ins' },
    { nome: 'RUMEL', cognome: 'HANNAN', email: '', ruolo: 'OPERATORE', oreMin: 40, oreMax: 40, costo: 7, postazioni: 'Fritti, Dolci/Ins, Lavaggio, Preparazione' }
];

async function populateStaff() {
    try {
        console.log('🗑️  Pulizia staff esistenti...');
        await prisma.staff.deleteMany();

        console.log('\n📝 Inserimento 35 dipendenti...');
        let count = 0;
        for (const s of staff) {
            await prisma.staff.create({
                data: {
                    ...s,
                    listIndex: count
                }
            });
            count++;
            console.log(`  ✓ ${count}. ${s.nome} ${s.cognome} (${s.ruolo})`);
        }

        console.log(`\n✅ Inseriti ${count} dipendenti con successo!`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

populateStaff();
