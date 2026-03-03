
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPassword(email) {
    const result = { status: 'pending' };
    try {
        console.log(`Hashing password...`);
        const hashedPassword = await bcrypt.hash('password123', 10);
        result.details = `hashing done. checking user...`;

        const exists = await prisma.user.findUnique({ where: { email } });

        let user;
        if (exists) {
            console.log("User found, updating...");
            user = await prisma.user.update({
                where: { email },
                data: { password: hashedPassword }
            });
            result.status = 'success';
            result.message = `Updated existing user: ${user.email} (ID: ${user.id})`;
        } else {
            console.log("User not found, creating...");
            try {
                user = await prisma.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        name: 'Ruslana Perekhrest',
                        role: 'USER'
                    }
                });
                result.status = 'success';
                result.message = `Created new user: ${user.email} (ID: ${user.id})`;
            } catch (createErr) {
                result.status = 'error_create';
                result.error = createErr.message;
            }
        }

    } catch (e) {
        result.status = 'error';
        result.error = e.message;
        console.error(e);
    } finally {
        await prisma.$disconnect();
        fs.writeFileSync('scripts/reset-result.json', JSON.stringify(result, null, 2));
    }
}

resetPassword('rusliperekhres@gmail.com');
