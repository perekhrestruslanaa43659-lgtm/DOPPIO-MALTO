const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'rusliperekhrest@gmail.com';
    console.log(`Verifying user: ${email}...`);

    try {
        const user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive'
                }
            }
        });

        if (!user) {
            console.log('User not found.');
            return;
        }

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true }
        });

        console.log('User verified successfully:', updated.email, updated.isVerified);
    } catch (e) {
        console.error('Error verifying user:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
