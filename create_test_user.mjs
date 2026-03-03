import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Find the owner to get the tenantKey
    const owner = await prisma.user.findFirst({
        where: { role: 'OWNER' }
    });

    if (!owner) {
        console.error('No OWNER found in database!');
        process.exit(1);
    }

    console.log(`Using tenantKey: ${owner.tenantKey}`);

    const hashedPassword = await bcrypt.hash('user', 10);

    // Upsert so we can re-run safely
    const user = await prisma.user.upsert({
        where: { email: 'user@gmail.com' },
        update: {
            password: hashedPassword,
            isVerified: true,
            verificationToken: null,
            role: 'USER',
        },
        create: {
            email: 'user@gmail.com',
            password: hashedPassword,
            name: 'Test User',
            role: 'USER',
            tenantKey: owner.tenantKey,
            isVerified: true,
            verificationToken: null,
        }
    });

    console.log(`✅ Test user created/updated: ${user.email} (id: ${user.id}, role: ${user.role}, verified: ${user.isVerified})`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
