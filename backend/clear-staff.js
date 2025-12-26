const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.staff.deleteMany().then(() => {
    console.log('✅ Tutti gli staff eliminati');
    prisma.$disconnect();
}).catch(e => {
    console.error('❌ Errore:', e.message);
    prisma.$disconnect();
});
