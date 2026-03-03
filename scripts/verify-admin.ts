import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Mostra tutti gli utenti e il loro stato di verifica
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, isVerified: true }
    });

    console.log('\n=== UTENTI TROVATI ===');
    users.forEach(u => {
        console.log(`[${u.isVerified ? '✅' : '❌'}] ${u.email} (${u.role}) - ID: ${u.id}`);
    });

    // Imposta isVerified = true per tutti gli utenti non verificati
    const result = await prisma.user.updateMany({
        where: { isVerified: false },
        data: { isVerified: true, verificationToken: null }
    });

    console.log(`\n✅ Aggiornati ${result.count} utenti → isVerified = true`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
