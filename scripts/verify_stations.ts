import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Verifying station rebranding in DB...');

    const staffs = await prisma.staff.findMany({
        where: {
            OR: [
                { postazioni: { contains: 'ACCGIU\'' } },
                { postazioni: { contains: 'ACCOGLIENZA' } },
                { postazioni: { contains: 'ACC' } }
            ]
        }
    });

    console.log(`Found ${staffs.length} staff members with related stations.`);

    staffs.forEach(s => {
        console.log(`- Staff ${s.id} (${s.nome} ${s.cognome}): ${s.postazioni}`);
    });

    const assignments = await prisma.assignment.count({
        where: { postazione: 'ACCGIU\'' }
    });
    console.log(`- Assignments with ACCGIU': ${assignments}`);

    const coverage = await prisma.coverageRow.count({
        where: { station: 'ACCGIU\'' }
    });
    console.log(`- Coverage rows with ACCGIU': ${coverage}`);

    console.log('🔍 Verification complete!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
