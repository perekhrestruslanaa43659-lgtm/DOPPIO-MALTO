
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEmailCase() {
    try {
        const email = 'Bpalinip@gmail.com';
        const lowerEmail = email.toLowerCase();

        console.log(`Fixing email case for ${email} -> ${lowerEmail}...`);

        const user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive'
                }
            }
        });

        if (user) {
            console.log(`Found user ID ${user.id} with email ${user.email}`);
            if (user.email !== lowerEmail) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { email: lowerEmail }
                });
                console.log("Updated to lowercase.");
            } else {
                console.log("Email is already lowercase.");
            }
        } else {
            console.log("User not found (insensitive search).");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

fixEmailCase();
