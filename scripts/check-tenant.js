
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ruslana = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!ruslana) { console.log('No Ruslana'); return; }

    console.log(`Staff Tenant: ${ruslana.tenantKey}`);

    const shifts = await prisma.recurringShift.findMany({
        where: { staffId: ruslana.id }
    });

    console.log(`--- Shifts (${shifts.length}) ---`);
    shifts.forEach(s => {
        console.log(`ID: ${s.id}, Tenant: ${s.tenantKey}, Match? ${s.tenantKey === ruslana.tenantKey}`);
    });
}

main().finally(() => prisma.$disconnect());
