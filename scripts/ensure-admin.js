
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking database connection and admin user...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ Error: DATABASE_URL is missing.');
        console.error('   Please run this script with: node --env-file=.env.local scripts/ensure-admin.js');
        process.exit(1);
    }

    try {
        const adminEmail = 'admin@doppiomalto.test';
        const user = await prisma.user.findUnique({
            where: { email: adminEmail }
        });

        if (user) {
            console.log('✅ Admin user ALREADY EXISTS.');
            console.log('   Email:', user.email);
            console.log('   Password: (hidden, use admin123)');
        } else {
            console.log('⚠️ Admin user NOT FOUND. Creating it now...');
            const hashedPassword = await bcrypt.hash('admin123', 10);

            await prisma.user.create({
                data: {
                    email: adminEmail,
                    password: hashedPassword,
                    name: 'Administrator',
                    role: 'OWNER',
                    tenantKey: 'locale-test-doppio-malto',
                    companyName: 'Doppio Malto - Test'
                }
            });
            console.log('✅ Admin user CREATED successfully.');
        }

    } catch (e) {
        console.error('❌ Error connecting to database:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
