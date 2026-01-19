const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const staffData = [
    { nome: 'LUCA', cognome: 'GNECCO', email: 'lgnecco@gmail.com', ruolo: 'RM', oreMinime: 40, oreMassime: 40, costoOra: 15, postazioni: ['BAR'] },
    { nome: 'GIULIA', cognome: 'BONZI', email: 'gbonzi@gmail.com', ruolo: 'VRM', oreMinime: 40, oreMassime: 40, costoOra: 14, postazioni: ['ACC'] },
    { nome: 'MARIAM', cognome: 'HANY', email: 'mhany@gmail.com', ruolo: 'JM', oreMinime: 40, oreMassime: 40, costoOra: 12, postazioni: ['ACC'] },
    { nome: 'PAOLO', cognome: 'PALINI', email: 'ppalini@gmail.com', ruolo: 'JM', oreMinime: 40, oreMassime: 40, costoOra: 10, postazioni: ['ACC'] },
    { nome: 'RUSLANA', cognome: 'PEREKHREST', email: 'rperekhrest@gmail.com', ruolo: 'in formazione', oreMinime: 30, oreMassime: 30, costoOra: 9, postazioni: ['ACC', 'CDR'] },
    { nome: 'BANCE', cognome: 'MOUSSA', email: 'bmoussa@gmail.com', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 8, postazioni: ['B/S'] },
    { nome: 'ERMANNO', cognome: 'BERTAZZONI', email: 'ebertazzoni@gmail.com', ruolo: 'L. 68/99', oreMinime: 30, oreMassime: 30, costoOra: 6, postazioni: ['B/S'] },
    { nome: 'ELENA', cognome: 'CAVALLO', email: 'ecavallo@gmail.com', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 8, postazioni: ['BARGIU', 'B/S', 'BARSU', 'CDR'] },
    { nome: 'AHMED', cognome: 'SALEM', email: 'asalem@gmail.com', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 8, postazioni: ['BARGIU', 'PASS', 'B/S', 'CDR'] },
    { nome: 'ELIAS', cognome: 'KARAM', email: 'ekaram@gmail.com', ruolo: 'OPERATORE', oreMinime: 24, oreMassime: 24, costoOra: 8, postazioni: ['B/S', 'BARGIU', 'PASS', 'CDR', 'BARSU'] },
    { nome: 'DAVID', cognome: 'VERMIGLIO', email: 'dvermiglio@gmail.com', ruolo: 'OPERATORE', oreMinime: 40, oreMassime: 40, costoOra: 8, postazioni: ['B/S', 'BARSU', 'CDR'] },
    { nome: 'MERAN', cognome: 'MOHAMED', email: 'mmohamed@gmail.com', ruolo: 'OPERATORE', oreMinime: 18, oreMassime: 18, costoOra: 8, postazioni: ['BARGIU', 'CDR', 'B/S', 'BARSU'] },
    { nome: 'CHIERICO', cognome: 'CHIARA', email: 'cchiara@gmail.com', ruolo: 'OPERATORE', oreMinime: 24, oreMassime: 24, costoOra: 8, postazioni: ['BARGIU', 'ACCSU', 'CDR', 'ACCSU', 'PASS'] },
    { nome: 'MATTEO', cognome: 'MONTELATICI', email: 'mmontelatici@gmail.com', ruolo: 'CHIAMATA', oreMinime: 0, oreMassime: 0, costoOra: 8, postazioni: ['BARGIU', 'B/S', 'CDR'] },
    { nome: 'CELESTE', cognome: 'MATHIEU', email: 'cmathieu@gmail.com', ruolo: 'ACC/OPS', oreMinime: 24, oreMassime: 24, costoOra: 8, postazioni: ['ACCGIU'] },
    { nome: 'REBECCA', cognome: 'GAZZOLA', email: 'rgazzola@gmail.com', ruolo: 'CHIAMATA', oreMinime: 0, oreMassime: 0, costoOra: 10, postazioni: ['BARSU', 'CDR'] },
    { nome: 'FRANCESCA', cognome: 'TACCOLINI', email: 'ftaccolini@gmail.com', ruolo: 'OPERATORE', oreMinime: 15, oreMassime: 15, costoOra: 8, postazioni: ['BARSU'] },
    { nome: 'SECK', cognome: 'CODOU', email: 'scodou@gmail.com', ruolo: 'OPERATORE', oreMinime: 25, oreMassime: 25, costoOra: 8, postazioni: ['BARSU', 'B/S'] },
    { nome: 'JENNIFER', cognome: 'GAMARRA', email: 'jgamarra@gmail.com', ruolo: 'TIROCINANTE', oreMinime: 20, oreMassime: 20, costoOra: 6, postazioni: ['SCARICO', 'B/S'] },
    { nome: 'MAMADOU', cognome: 'DIALLO', email: 'mdiallo@gmail.com', ruolo: 'TIROCINANTE', oreMinime: 40, oreMassime: 40, costoOra: 6, postazioni: ['B/S', 'PASS'] },
    { nome: 'STEVENS', cognome: 'CARZANIGA', email: 'scarzaniga@gmail.com', ruolo: 'TIROCINANTE', oreMinime: 30, oreMassime: 30, costoOra: 6, postazioni: ['CDR', 'BARGIU', 'B/S'] },
    { nome: 'NETTRA', cognome: 'NIRMANI', email: 'nnirmani@gmail.com', ruolo: 'CHIAMATA', oreMinime: 0, oreMassime: 0, costoOra: 10, postazioni: ['CDR', 'BARGIU', 'B/S'] },
    { nome: 'WALID', cognome: 'LARJANI', email: 'wlarjani@gmail.com', ruolo: 'OPERATORE', oreMinime: 30, oreMassime: 30, costoOra: 6, postazioni: ['CDR', 'B/S'] },
    { nome: 'LUCA', cognome: 'CORDONATTO', email: 'lcordonatto@gmail.com', ruolo: 'CHIAMATA', oreMinime: 0, oreMassime: 0, costoOra: 10, postazioni: ['B/S'] }
];

async function main() {
    console.log(`Start seeding ${staffData.length} users...`);
    for (const u of staffData) {
        // Check if duplicate email
        const exists = await prisma.staff.findUnique({ where: { email: u.email } });
        if (!exists) {
            await prisma.staff.create({ data: u });
            console.log(`Created ${u.nome} ${u.cognome}`);
        } else {
            // Optional: Update?
            console.log(`Skipped ${u.nome} (already exists)`);
        }
    }
    console.log('Seeding finished.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
