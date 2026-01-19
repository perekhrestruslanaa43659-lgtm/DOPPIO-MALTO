const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function runMigration() {
    console.log('🔧 Running SQL Migration to fix postazioni field...\n');

    try {
        // Execute migration steps one by one
        console.log('Step 1: Adding temporary column...');
        await prisma.$executeRaw`ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS postazioni_new text[]`;

        console.log('Step 2: Migrating data to new column...');
        await prisma.$executeRaw`
            UPDATE "Staff" 
            SET postazioni_new = CASE 
                WHEN postazioni::text = '' OR postazioni::text = '{}' THEN ARRAY[]::text[]
                WHEN postazioni::text LIKE '{%}' THEN 
                    string_to_array(
                        regexp_replace(
                            regexp_replace(postazioni::text, '^{', ''), 
                            '}$', ''
                        ), 
                        ','
                    )
                ELSE 
                    string_to_array(postazioni::text, ',')
            END
        `;

        console.log('Step 3: Cleaning up array values...');
        await prisma.$executeRaw`
            UPDATE "Staff"
            SET postazioni_new = ARRAY(
                SELECT trim(elem)
                FROM unnest(postazioni_new) AS elem
                WHERE trim(elem) != ''
            )
        `;

        console.log('Step 4: Dropping old column...');
        await prisma.$executeRaw`ALTER TABLE "Staff" DROP COLUMN postazioni`;

        console.log('Step 5: Renaming new column...');
        await prisma.$executeRaw`ALTER TABLE "Staff" RENAME COLUMN postazioni_new TO postazioni`;

        console.log('Step 6: Setting default and NOT NULL constraint...');
        await prisma.$executeRaw`ALTER TABLE "Staff" ALTER COLUMN postazioni SET DEFAULT ARRAY[]::text[]`;
        await prisma.$executeRaw`UPDATE "Staff" SET postazioni = ARRAY[]::text[] WHERE postazioni IS NULL`;
        await prisma.$executeRaw`ALTER TABLE "Staff" ALTER COLUMN postazioni SET NOT NULL`;

        console.log('\n✅ Migration completed successfully!\n');

        // Verify with Prisma ORM
        console.log('🧪 Verification with Prisma ORM...');
        const staff = await prisma.staff.findMany({
            select: { id: true, nome: true, cognome: true, postazioni: true },
            take: 10,
            orderBy: { id: 'asc' }
        });

        console.log('✅ SUCCESS! Sample data:');
        staff.forEach(s => {
            console.log(`  - ID ${s.id}: ${s.nome} ${s.cognome} - ${JSON.stringify(s.postazioni)}`);
        });

        const totalCount = await prisma.staff.count();
        console.log(`\n✅ Total staff accessible: ${totalCount}`);

        // Test list_staff.js
        console.log('\n🧪 Testing list_staff.js functionality...');
        const allStaff = await prisma.staff.findMany({
            orderBy: { id: 'asc' }
        });
        console.log(`✅ Can fetch all ${allStaff.length} staff records successfully!`);

    } catch (error) {
        console.error('❌ Migration error:', error.message);
        console.error('Error code:', error.code);
        console.error('\nFull error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runMigration();
