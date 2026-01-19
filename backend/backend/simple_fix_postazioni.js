const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simpleFix() {
    console.log('🔧 Simple Fix for postazioni field...\n');

    try {
        // Get all IDs without using pg_typeof
        const allStaff = await prisma.$queryRaw`
            SELECT id, nome, postazioni::text as postazioni_text
            FROM "Staff" 
            ORDER BY id
        `;

        console.log(`Found ${allStaff.length} staff records\n`);

        let fixedCount = 0;

        for (const staff of allStaff) {
            const postazioniText = staff.postazioni_text;
            let arrayValue = [];

            // Parse the text representation
            if (!postazioniText || postazioniText === '{}' || postazioniText.trim() === '') {
                arrayValue = [];
            } else if (postazioniText.startsWith('{') && postazioniText.endsWith('}')) {
                // PostgreSQL array format: {item1,item2,item3}
                const inner = postazioniText.slice(1, -1);
                if (inner.trim()) {
                    arrayValue = inner.split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(s => s);
                }
            } else {
                // Plain string, split by comma
                arrayValue = postazioniText.split(',').map(s => s.trim()).filter(s => s);
            }

            // Update with ARRAY constructor
            if (arrayValue.length === 0) {
                await prisma.$executeRaw`
                    UPDATE "Staff" 
                    SET postazioni = ARRAY[]::text[]
                    WHERE id = ${staff.id}
                `;
            } else {
                await prisma.$executeRaw`
                    UPDATE "Staff" 
                    SET postazioni = ${arrayValue}::text[]
                    WHERE id = ${staff.id}
                `;
            }

            fixedCount++;
            if (fixedCount <= 10 || fixedCount > allStaff.length - 3) {
                console.log(`✅ ID ${staff.id} (${staff.nome}): ${JSON.stringify(arrayValue)}`);
            } else if (fixedCount === 11) {
                console.log('   ... (processing remaining records) ...');
            }
        }

        console.log(`\n📊 Fixed ${fixedCount} records`);

        // Verification
        console.log('\n🧪 Verification with Prisma ORM...');
        const testStaff = await prisma.staff.findMany({
            select: { id: true, nome: true, postazioni: true },
            take: 5,
            orderBy: { id: 'asc' }
        });

        console.log('✅ SUCCESS! Sample data:');
        testStaff.forEach(s => {
            console.log(`  - ID ${s.id}: ${s.nome} - ${JSON.stringify(s.postazioni)}`);
        });

        const totalCount = await prisma.staff.count();
        console.log(`\n✅ Total staff accessible: ${totalCount}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code) console.error('Error code:', error.code);
    } finally {
        await prisma.$disconnect();
    }
}

simpleFix();
