
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log('Users in DB:', JSON.stringify(users.map(u => ({ id: u.id, email: u.email, tenantKey: u.tenantKey, role: u.role })), null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
