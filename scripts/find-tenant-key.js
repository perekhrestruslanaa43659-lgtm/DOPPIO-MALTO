
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    let output = `Users found: ${users.length}\n`;
    users.forEach(u => {
        output += `User: ${u.email}, Tenant: ${u.tenantKey}\n`;
    });
    fs.writeFileSync('debug_tenant.txt', output);
}

main()
    .catch(e => {
        console.error(e);
        fs.writeFileSync('debug_tenant.txt', 'Error: ' + e.message);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
