
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const staffName = "SUPPORTO";
    const staff = await prisma.staff.findMany({
        where: {
            nome: { contains: staffName, mode: 'insensitive' }
        }
    });

    console.log('Found staff:', JSON.stringify(staff.map(s => ({ id: s.id, nome: s.nome, tenantKey: s.tenantKey })), null, 2));

    if (staff.length > 0) {
        const assignments = await prisma.assignment.findMany({
            where: { staffId: { in: staff.map(s => s.id) } },
            take: 10
        });
        console.log('Latest assignments for these staff:', JSON.stringify(assignments, null, 2));
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
