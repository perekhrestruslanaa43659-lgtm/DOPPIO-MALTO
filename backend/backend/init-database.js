// Script di inizializzazione database - Popola tutti i dati necessari
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const staff = [
    // Management
    { nome: 'LUCA', cognome: 'GNECCO', email: 'lucagnecco@gmail.com', ruolo: 'RM', oreMinime: 40, oreMassime: 40, costoOra: 15, postazioni: '', moltiplicatore: 1.0, listIndex: 0 },
    { nome: 'GIULIA', cognome: 'BONZI', email: 'Giulia.bonzi@gmail.com', ruolo: 'VRM', oreMinime: 40, oreMassime: 40, costoOra: 14, postazioni: '', moltiplicatore: 1.0, listIndex: 1 },
    { nome: 'MARIAM', cognome: 'HANY', email: 'mariam@gmail.com', ruolo: 'JM', oreMinime: 40, oreMassime: 40, costoOra: 12, postazioni: '', moltiplicatore: 1.0, listIndex: 2 },
    { nome: 'PAOLO', cognome: 'PALINI', email: 'paolo@gmail.com', ruolo: 'JM', oreMinime: 40, oreMassime: 40, costoOra: 10, postazioni: '', moltiplicatore: 1.0, listIndex: 3 },

    // Operatori Sala/Bar
    { nome: 'RUSLANA', cognome: 'PEREKHREST', email: 'rusliperekhrest@gmail.com', ruolo: 'in formazione', oreMinime: 30, oreMassime: 30, costoOra: 9, postazioni: 'CDR, ACC', moltiplicatore: 1.0, listIndex: 4 },
    { nome: 'BANCE', cognome: 'MOUSSA', email: 'bance@gmail.com', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 8, postazioni: 'PASS', moltiplicatore: 1.0, listIndex: 5 },
    { nome: 'ERMANNO', cognome: 'BERTAZZONI', email: 'ermanno@gmail.com', ruolo: 'L. 68/99', oreMinime: 30, oreMassime: 30, costoOra: 6, postazioni: 'B/S', moltiplicatore: 0.5, listIndex: 6 },
    { nome: 'ELENA', cognome: 'CAVALLO', email: 'elena@gmail.com', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 8, postazioni: 'BARGIU, B/S, BARSU, CDR', moltiplicatore: 1.0, listIndex: 7 },
    { nome: 'AHMED', cognome: 'SALEM', email: 'ahmed@gmail.com', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 8, postazioni: 'BARGIU, PASS, B/S, CDR', moltiplicatore: 1.0, listIndex: 8 },
    { nome: 'ELIAS', cognome: 'KARAM', email: 'elias@gmail.com', ruolo: 'OPERATORE', oreMinime: 24, oreMassime: 24, costoOra: 8, postazioni: 'B/S, BARGIU, PASS, CDR, BARSU', moltiplicatore: 1.0, listIndex: 9 },
    { nome: 'DAVID', cognome: 'VERMIGLIO', email: 'david@gmail.com', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 8, postazioni: 'B/S, BARSU, CDR', moltiplicatore: 1.0, listIndex: 10 },
    { nome: 'MERAN', cognome: 'MOHAMED', email: 'meran@gmail.com', ruolo: 'OPERATORE', oreMinime: 18, oreMassime: 18, costoOra: 8, postazioni: 'BARGIU, CDR, B/S, BARSU', moltiplicatore: 1.0, listIndex: 11 },
    { nome: 'CHIERICO', cognome: 'CHIARA', email: 'chiara@gmail.com', ruolo: 'OPERATORE', oreMinime: 24, oreMassime: 24, costoOra: 8, postazioni: 'BARGIU, ACCSU, CDR, PASS', moltiplicatore: 1.0, listIndex: 12 },
    { nome: 'CELESTE', cognome: 'MATHIEU', email: 'celeste@gmail.com', ruolo: 'ACC/OPS', oreMinime: 24, oreMassime: 24, costoOra: 8, postazioni: 'ACCGIU', moltiplicatore: 1.0, listIndex: 13 },
    { nome: 'FRANCESCA', cognome: 'TACCOLINI', email: 'francesca@gmail.com', ruolo: 'OPERATORE', oreMinime: 15, oreMassime: 15, costoOra: 8, postazioni: 'BARSU', moltiplicatore: 1.0, listIndex: 14 },
    { nome: 'SECK', cognome: 'CODOU', email: 'seck@gmail.com', ruolo: 'OPERATORE', oreMinime: 25, oreMassime: 25, costoOra: 8, postazioni: 'BARSU, B/S', moltiplicatore: 1.0, listIndex: 15 },
    { nome: 'WALID', cognome: 'LARJANI', email: 'walid@gmail.com', ruolo: 'OPERATORE', oreMinime: 30, oreMassime: 30, costoOra: 6, postazioni: 'CDR, B/S', moltiplicatore: 1.0, listIndex: 16 },

    // Tirocinanti (moltiplicatore 0 - non pesano su produttività)
    { nome: 'JENNIFER', cognome: 'GAMARRA', email: 'jennifer@gmail.com', ruolo: 'TIROCINANTE', oreMinime: 20, oreMassime: 20, costoOra: 6, postazioni: 'SCARICO, B/S', moltiplicatore: 0, listIndex: 17 },
    { nome: 'MAMADOU', cognome: 'DIALLO', email: 'mamadou@gmail.com', ruolo: 'TIROCINANTE', oreMinime: 40, oreMassime: 40, costoOra: 6, postazioni: 'B/S, PASS', moltiplicatore: 0, listIndex: 18 },
    { nome: 'STEVENS', cognome: 'CARZANIGA', email: 'stevens@gmail.com', ruolo: 'TIROCINANTE', oreMinime: 30, oreMassime: 30, costoOra: 6, postazioni: 'CDR, BARGIU, B/S', moltiplicatore: 0, listIndex: 19 },

    // Chiamata
    { nome: 'MATTEO', cognome: 'MONTELATICI', email: 'matteo@gmail.com', ruolo: 'CHIAMATA', oreMinime: 0, oreMassime: 0, costoOra: 8, postazioni: 'BARGIU, B/S, CDR', moltiplicatore: 1.0, listIndex: 20 },
    { nome: 'REBECCA', cognome: 'GAZZOLA', email: 'rebecca@gmail.com', ruolo: 'CHIAMATA', oreMinime: 0, oreMassime: 0, costoOra: 10, postazioni: 'BARSU, CDR', moltiplicatore: 1.0, listIndex: 21 },
    { nome: 'NETTRA', cognome: 'NIRMANI', email: 'netra@gmail.com', ruolo: 'CHIAMATA', oreMinime: 0, oreMassime: 0, costoOra: 10, postazioni: 'CDR, BARGIU, B/S', moltiplicatore: 1.0, listIndex: 22 },
    { nome: 'LUCA', cognome: 'CORDONATTO', email: 'luca@gmail.com', ruolo: 'CHIAMATA', oreMinime: 0, oreMassime: 0, costoOra: 10, postazioni: 'B/S', moltiplicatore: 1.0, listIndex: 23 },

    // Cucina (BOH)
    { nome: 'ABIR', cognome: 'HOSSAIN', email: 'abir.hossain@scheduflow.local', ruolo: 'KM', oreMinime: 40, oreMassime: 40, costoOra: 12, postazioni: 'CUCINA', moltiplicatore: 1.0, listIndex: 24 },
    { nome: 'IMRAN', cognome: 'MOLLA', email: 'imran.molla@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 9, postazioni: 'PIRA, BURGER, FRITTI, PREPARAZIONE', moltiplicatore: 1.0, listIndex: 25 },
    { nome: 'SHOHEL', cognome: 'MATUBBER', email: 'shohel.matubber@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 9, postazioni: 'PIRA, BURGER, FRITTI, PREPARAZIONE', moltiplicatore: 1.0, listIndex: 26 },
    { nome: 'JUBAIR', cognome: 'AHMED', email: 'jubair.ahmed@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 7, postazioni: 'LAVAGGIO, FRITTI, DOLCI', moltiplicatore: 1.0, listIndex: 27 },
    { nome: 'SAHIDUL', cognome: 'ISLAM', email: 'sahidul.islam@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 7, postazioni: 'BURGER, PREPARAZIONE', moltiplicatore: 1.0, listIndex: 28 },
    { nome: 'SHOAG', cognome: 'AHMED', email: 'shoag.ahmed@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 7, postazioni: 'BURGER, PREPARAZIONE, LAVAGGIO, FRITTI, DOLCI', moltiplicatore: 1.0, listIndex: 29 },
    { nome: 'BABUL', cognome: 'MIAH MD', email: 'babul.miah@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 7, postazioni: 'BURGER, PREPARAZIONE, FRITTI, DOLCI, LAVAGGIO', moltiplicatore: 1.0, listIndex: 30 },
    { nome: 'ADIL', cognome: 'AHMED', email: 'adil.ahmed@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 7, postazioni: 'PIZZA, FRITTI, DOLCI, PREPARAZIONE, LAVAGGIO', moltiplicatore: 1.0, listIndex: 31 },
    { nome: 'JAHIDUR', cognome: 'RAHMAN', email: 'jahidur.rahman@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 7, postazioni: 'PIZZA, FRITTI, DOLCI, PREPARAZIONE, LAVAGGIO', moltiplicatore: 1.0, listIndex: 32 },
    { nome: 'SUAB', cognome: 'AHMED', email: 'suab.ahmed@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 7, postazioni: 'BURGER, PREPARAZIONE, FRITTI, DOLCI', moltiplicatore: 1.0, listIndex: 33 },
    { nome: 'RUMEL', cognome: 'HANNAN', email: 'rumel.hannan@scheduflow.local', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 7, postazioni: 'FRITTI, DOLCI, LAVAGGIO, PREPARAZIONE', moltiplicatore: 1.0, listIndex: 34 }
];

async function initDatabase() {
    try {
        console.log('🔍 Verifica database...');

        // Controlla se ci sono già staff
        const count = await prisma.staff.count();

        if (count > 0) {
            console.log(`✅ Database già popolato con ${count} staff`);
            return;
        }

        console.log('📝 Database vuoto - Popolamento in corso...');

        // Inserisci staff
        for (const s of staff) {
            await prisma.staff.create({ data: s });
        }

        console.log(`✅ Inseriti ${staff.length} dipendenti con successo!`);

    } catch (error) {
        console.error('❌ Errore inizializzazione database:', error.message);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };
