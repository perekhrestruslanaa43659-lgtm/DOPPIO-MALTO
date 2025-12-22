const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const staffList = [
    { nome: 'ABIR', cognome: 'HOSSAIN' },
    { nome: 'IMRAN', cognome: 'MOLLA' },
    { nome: 'SHOHEL', cognome: 'MATUBBER' },
    { nome: 'JUBAIR', cognome: 'AHMED' },
    { nome: 'SAHIDUL', cognome: 'ISLAM' },
    { nome: 'SHOAG', cognome: 'AHMED' },
    { nome: 'BABUL', cognome: 'MIAH MD' },
    { nome: 'ADIL', cognome: 'AHMED' },
    { nome: 'JAHIDUR', cognome: 'RAHMAN' },
    { nome: 'SUAB', cognome: 'AHMED' },
    { nome: 'RUMEL', cognome: 'HANNAN' },
    { nome: 'RIMON', cognome: 'CHWODRY' }
];

async function main() {
    console.log("Adding Kitchen Staff...");

    for (const s of staffList) {
        // Upsert based on name+cognome (approximate)
        // Since we don't have unique constraint on Name, we check manually
        const existing = await prisma.staff.findFirst({
            where: {
                nome: { equals: s.nome, mode: 'insensitive' },
                cognome: { equals: s.cognome, mode: 'insensitive' }
            }
        });

        if (existing) {
            console.log(`Skipping existing: ${s.nome} ${s.cognome}`);
        } else {
            await prisma.staff.create({
                data: {
                    nome: s.nome,
                    cognome: s.cognome,
                    ruolo: 'CUCINA',
                    oreMassime: 40,
                    oreMinime: 0,
                    postazioni: ['CUCINA'],
                    email: `${s.nome.toLowerCase()}.${s.cognome.toLowerCase().replace(/\s/g, '')}@example.com` // Dummy email
                }
            });
            console.log(`Added: ${s.nome} ${s.cognome}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
