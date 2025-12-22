const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting cleanup...");

    // 1. Delete by known incorrect codes seen in screenshot
    const invalidNames = [
        'BARGIU', 'BARSU', 'ACCSU', 'CDR',
        'CDR_V', 'CDR_S', 'CDR_D',
        'ACCGIU_V', 'ACCGIU:S', 'ACCGIU:_D',
        'B/S', 'B/S_2', 'B/S_V', 'B/S_S', 'B/S_D',
        'SCARICO', 'PASS', 'MATTINA', 'POMERIGGIO', 'SERA'
    ];

    const deleteByName = await prisma.staff.deleteMany({
        where: {
            nome: { in: invalidNames }
        }
    });
    console.log(`Deleted ${deleteByName.count} staff by invalid names.`);

    // 2. Delete by placeholder email (heuristic from previous bad import)
    const deleteByEmail = await prisma.staff.deleteMany({
        where: {
            email: { contains: '@placeholder.com' }
        }
    });
    console.log(`Deleted ${deleteByEmail.count} staff by placeholder email.`);

    // 3. Delete specifically "STAFF" entry if it exists
    const deleteStaffLabel = await prisma.staff.deleteMany({
        where: {
            nome: 'Staff'
        }
    });

    const remaining = await prisma.staff.count();
    console.log(`Cleanup complete. Remaining staff: ${remaining}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
