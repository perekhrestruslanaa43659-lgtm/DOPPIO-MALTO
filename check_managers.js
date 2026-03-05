
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const managers = ["LUCA", "GIULIA", "PAOLO", "RUSLANA", "JUAN"];
    const staff = await prisma.staff.findMany({
        where: {
            nome: { in: managers, mode: 'insensitive' },
            tenantKey: "locale-test-doppio-malto"
        },
        select: { id: true, nome: true, ruolo: true, postazioni: true, archived: true, productivityWeight: true }
    });

    console.log('Manager staff details:', JSON.stringify(staff, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
