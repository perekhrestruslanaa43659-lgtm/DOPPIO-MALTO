
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPasswordPaolo() {
    const email = 'Bpalinip@gmail.com';
    const password = 'paolo123';

    try {
        console.log(`Setting password for ${email}...`);
        const hashedPassword = await bcrypt.hash(password, 10);

        const exists = await prisma.user.findUnique({ where: { email } });

        let user;
        if (exists) {
            user = await prisma.user.update({
                where: { email },
                data: { password: hashedPassword }
            });
            console.log(`SUCCESS: Updated existing user: ${user.email} (ID: ${user.id})`);
        } else {
            try {
                user = await prisma.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        name: 'Paolo Palini',
                        role: 'USER',
                    }
                });
                console.log(`SUCCESS: Created new user: ${user.email} (ID: ${user.id})`);
            } catch (createErr) {
                console.error("Error creating user:", createErr);
            }
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

resetPasswordPaolo();
