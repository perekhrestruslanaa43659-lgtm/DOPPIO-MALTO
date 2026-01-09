const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAndFix() {
    console.log('🔍 Verifying postazioni field...\n');

    try {
        // Check raw data
        const rawCheck = await prisma.$queryRaw`
            SELECT id, nome, postazioni, pg_typeof(postazioni) as type
            FROM "Staff" 
            LIMIT 5
        `;

        console.log('Raw data from database:');
        rawCheck.forEach(row => {
            console.log(`ID ${row.id}: ${row.nome}`);
            console.log(`  Type: ${row.type}`);
            console.log(`  Value: ${JSON.stringify(row.postazioni)}`);
            console.log(`  JS Type: ${typeof row.postazioni}, IsArray: ${Array.isArray(row.postazioni)}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('Attempting to fix by ensuring proper array format...\n');

        // Get all IDs
        const allIds = await prisma.$queryRaw`SELECT id FROM "Staff" ORDER BY id`;

        let successCount = 0;
        let errorCount = 0;

        for (const { id } of allIds) {
            try {
                // Get current value
                const current = await prisma.$queryRaw`
                    SELECT postazioni FROM "Staff" WHERE id = ${id}
                `;

                const currentValue = current[0]?.postazioni;
                let arrayValue = [];

                // Convert to proper array
                if (typeof currentValue === 'string') {
                    if (currentValue.trim() === '' || currentValue === '{}') {
                        arrayValue = [];
                    } else {
                        // Parse comma-separated values
                        arrayValue = currentValue.split(',').map(s => s.trim()).filter(s => s);
                    }
                } else if (Array.isArray(currentValue)) {
                    arrayValue = currentValue;
                } else if (currentValue === null || currentValue === undefined) {
                    arrayValue = [];
                }

                // Update with proper PostgreSQL array syntax
                if (arrayValue.length === 0) {
                    await prisma.$executeRaw`
                        UPDATE "Staff" 
                        SET postazioni = ARRAY[]::text[]
                        WHERE id = ${id}
                    `;
                } else {
                    await prisma.$executeRaw`
                        UPDATE "Staff" 
                        SET postazioni = ${arrayValue}::text[]
                        WHERE id = ${id}
                    `;
                }

                successCount++;
                if (successCount <= 5) {
                    console.log(`✅ ID ${id}: ${JSON.stringify(arrayValue)}`);
                }
            } catch (error) {
                console.error(`❌ Error fixing ID ${id}: ${error.message}`);
                errorCount++;
            }
        }

        console.log(`\n📊 Updated ${successCount} records, ${errorCount} errors`);

        // Final verification with Prisma ORM
        console.log('\n🧪 Final Verification with Prisma ORM...');
        try {
            const staff = await prisma.staff.findMany({
                select: { id: true, nome: true, postazioni: true },
                take: 5,
                orderBy: { id: 'asc' }
            });

            console.log('✅ SUCCESS! Prisma can now read the data:');
            staff.forEach(s => {
                console.log(`  - ID ${s.id}: ${s.nome} - ${JSON.stringify(s.postazioni)}`);
            });

            // Test count
            const count = await prisma.staff.count();
            console.log(`\n✅ Total staff count: ${count}`);

        } catch (error) {
            console.error('❌ Verification still failed:', error.message);
            console.error('Full error:', error);
        }

    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyAndFix();
