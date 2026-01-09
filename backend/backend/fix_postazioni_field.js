const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPostazioniField() {
    console.log('🔧 Fixing postazioni field in Staff table...\n');

    try {
        // Get all staff using raw query to avoid the array parsing error
        const staffRaw = await prisma.$queryRaw`
            SELECT id, nome, cognome, postazioni 
            FROM "Staff" 
            ORDER BY id ASC
        `;

        console.log(`Found ${staffRaw.length} staff records\n`);

        let fixedCount = 0;
        let alreadyOkCount = 0;
        let errors = [];

        for (const staff of staffRaw) {
            const postazioni = staff.postazioni;

            // Check if postazioni is a string (empty or otherwise)
            if (typeof postazioni === 'string') {
                console.log(`❌ ID ${staff.id} (${staff.nome} ${staff.cognome}): postazioni is STRING "${postazioni}"`);

                try {
                    // Convert empty string to empty array, or parse if it's a JSON string
                    let newValue = [];
                    if (postazioni.trim() !== '') {
                        try {
                            // Try to parse as JSON array
                            const parsed = JSON.parse(postazioni);
                            if (Array.isArray(parsed)) {
                                newValue = parsed;
                            } else {
                                // If it's a single value, make it an array
                                newValue = [postazioni];
                            }
                        } catch {
                            // If not JSON, treat as comma-separated or single value
                            if (postazioni.includes(',')) {
                                newValue = postazioni.split(',').map(p => p.trim()).filter(p => p);
                            } else {
                                newValue = [postazioni.trim()];
                            }
                        }
                    }

                    // Update using raw query
                    await prisma.$executeRaw`
                        UPDATE "Staff" 
                        SET postazioni = ${newValue}::text[]
                        WHERE id = ${staff.id}
                    `;

                    console.log(`   ✅ Fixed: ${JSON.stringify(newValue)}`);
                    fixedCount++;
                } catch (error) {
                    console.error(`   ⚠️  Error fixing ID ${staff.id}: ${error.message}`);
                    errors.push({ id: staff.id, error: error.message });
                }
            } else if (Array.isArray(postazioni)) {
                console.log(`✅ ID ${staff.id} (${staff.nome} ${staff.cognome}): Already OK - ${JSON.stringify(postazioni)}`);
                alreadyOkCount++;
            } else {
                console.log(`⚠️  ID ${staff.id} (${staff.nome} ${staff.cognome}): Unknown type ${typeof postazioni}`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total records: ${staffRaw.length}`);
        console.log(`✅ Already OK: ${alreadyOkCount}`);
        console.log(`🔧 Fixed: ${fixedCount}`);
        console.log(`❌ Errors: ${errors.length}`);

        if (errors.length > 0) {
            console.log('\n⚠️  Errors encountered:');
            errors.forEach(e => console.log(`   - ID ${e.id}: ${e.error}`));
        }

        // Verify by trying to fetch with Prisma ORM
        console.log('\n🧪 Verification: Attempting to fetch all staff with Prisma...');
        try {
            const verifyStaff = await prisma.staff.findMany({
                select: { id: true, nome: true, postazioni: true },
                take: 5
            });
            console.log('✅ SUCCESS! First 5 staff:');
            verifyStaff.forEach(s => {
                console.log(`   - ID ${s.id}: ${s.nome} - ${JSON.stringify(s.postazioni)}`);
            });
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
        }

    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixPostazioniField();
