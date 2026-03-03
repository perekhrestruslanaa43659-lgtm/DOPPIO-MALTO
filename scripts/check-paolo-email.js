
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPaoloEmail() {
    try {
        const email1 = 'bpalinip@gmail.com';
        const email2 = 'bpalini@gmail.com'; // Typo version?

        console.log(`Checking accounts...`);

        const user1 = await prisma.user.findFirst({
            where: { email: { equals: email1, mode: 'insensitive' } }
        });
        if (user1) console.log(`FOUND: ${user1.email} (ID: ${user1.id})`);
        else console.log(`NOT FOUND: ${email1}`);

        const user2 = await prisma.user.findFirst({
            where: { email: { equals: email2, mode: 'insensitive' } }
        });
        if (user2) console.log(`FOUND: ${user2.email} (ID: ${user2.id})`);
        else console.log(`NOT FOUND: ${email2}`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkPaoloEmail();
