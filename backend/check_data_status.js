const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    console.log('📊 Checking Database Data Status...\n');

    try {
        const staffCount = await prisma.staff.count();
        const coverageCount = await prisma.coverageRow.count();
        const budgetCount = await prisma.budget.count();
        const assignmentCount = await prisma.assignment.count();
        const userCount = await prisma.user.count();

        console.log('='.repeat(50));
        console.log('DATABASE STATUS');
        console.log('='.repeat(50));
        console.log(`Staff:        ${staffCount} records`);
        console.log(`Coverage:     ${coverageCount} records`);
        console.log(`Budget:       ${budgetCount} records`);
        console.log(`Assignments:  ${assignmentCount} records`);
        console.log(`Users:        ${userCount} records`);
        console.log('='.repeat(50));

        if (coverageCount === 0) {
            console.log('\n⚠️  Coverage table is EMPTY');
            console.log('   Scheduling functionality will not work until coverage data is imported.');
            console.log('   Use import_data.js or the API endpoint to import coverage data.');
        } else {
            console.log('\n✅ Coverage data is present');
            const sample = await prisma.coverageRow.findFirst();
            console.log('   Sample coverage row:');
            console.log(`   - Station: ${sample.station}`);
            console.log(`   - Frequency: ${sample.frequency}`);
            console.log(`   - Week Start: ${sample.weekStart}`);
        }

        if (budgetCount === 0) {
            console.log('\n⚠️  Budget table is EMPTY');
        } else {
            console.log(`\n✅ Budget data present (${budgetCount} records)`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
