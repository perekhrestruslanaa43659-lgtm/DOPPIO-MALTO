const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    try {
        const email = 'admin@scheduling.com';
        const password = 'admin';
        const hash = await bcrypt.hash(password, 10);

        const user = await prisma.user.upsert({
            where: { email },
            update: { password: hash, role: 'ADMIN' },
            create: { email, password: hash, name: 'Admin', role: 'ADMIN' }
        });
        console.log("Admin user upserted:", user.email);

        const rusla = await prisma.user.upsert({
            where: { email: 'rusliperekhrest@gmail.com' },
            update: { password: await bcrypt.hash('RUSLANA2026', 10), role: 'USER' },
            create: { email: 'rusliperekhrest@gmail.com', password: await bcrypt.hash('RUSLANA2026', 10), name: 'Ruslana', role: 'USER' }
        });
        console.log("Ruslana user upserted:", rusla.email);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
