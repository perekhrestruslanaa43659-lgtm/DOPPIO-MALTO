
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUG USER DATA ---');
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users.`);
    users.forEach(u => {
        console.log(`User: ${u.email}, Role: ${u.role}, Tenant: ${u.tenantKey}`);
    });

    console.log('\n--- DEBUG STAFF DATA ---');
    const staff = await prisma.staff.findMany();
    console.log(`Found ${staff.length} staff members.`);
    staff.forEach(s => {
        console.log(`Staff: ${s.nome} ${s.cognome}, Tenant: ${s.tenantKey}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
