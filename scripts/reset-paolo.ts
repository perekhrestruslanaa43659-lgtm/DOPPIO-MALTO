
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
                        //@ts-ignore
                        role: 'USER',
                    }
                });
                console.log(`SUCCESS: Created new user: ${user.email} (ID: ${user.id})`);
            } catch (createErr: any) {
                console.error("Error creating user:", createErr);
            }
        }

    } catch (e: any) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

resetPasswordPaolo();
