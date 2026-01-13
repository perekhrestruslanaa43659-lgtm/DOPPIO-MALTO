import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Define test tenant
    const testTenantKey = 'locale-test-doppio-malto';
    const testCompanyName = 'Doppio Malto - Test';

    // Create admin user
    const adminEmail = 'admin@doppiomalto.test';
    const adminPassword = 'admin123'; // Change this in production!

    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
    });

    if (!existingAdmin) {
        const hashedPassword = await hashPassword(adminPassword);

        const admin = await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                name: 'Administrator',
                role: 'OWNER',
                tenantKey: testTenantKey,
                companyName: testCompanyName,
            },
        });

        console.log('✅ Admin user created:', {
            email: admin.email,
            password: adminPassword,
            role: admin.role,
            tenantKey: admin.tenantKey,
            companyName: admin.companyName,
        });

        // Create sample staff
        console.log('📝 Creating sample staff...');

        const staff = await prisma.staff.createMany({
            data: [
                {
                    tenantKey: testTenantKey,
                    nome: 'Mario',
                    cognome: 'Rossi',
                    email: 'mario.rossi@doppiomalto.test',
                    ruolo: 'CAMERIERE',
                    oreMinime: 20,
                    oreMassime: 40,
                    costoOra: 12.5,
                    postazioni: ['SALA', 'BAR'],
                    listIndex: 1,
                },
                {
                    tenantKey: testTenantKey,
                    nome: 'Giulia',
                    cognome: 'Bianchi',
                    email: 'giulia.bianchi@doppiomalto.test',
                    ruolo: 'CUOCO',
                    oreMinime: 30,
                    oreMassime: 40,
                    costoOra: 15.0,
                    postazioni: ['CUCINA'],
                    listIndex: 2,
                },
                {
                    tenantKey: testTenantKey,
                    nome: 'Luca',
                    cognome: 'Verdi',
                    email: 'luca.verdi@doppiomalto.test',
                    ruolo: 'BARISTA',
                    oreMinime: 15,
                    oreMassime: 35,
                    costoOra: 13.0,
                    postazioni: ['BAR'],
                    listIndex: 3,
                },
                {
                    tenantKey: testTenantKey,
                    nome: 'Sofia',
                    cognome: 'Neri',
                    email: 'sofia.neri@doppiomalto.test',
                    ruolo: 'CAMERIERE',
                    oreMinime: 20,
                    oreMassime: 40,
                    costoOra: 12.0,
                    postazioni: ['SALA'],
                    listIndex: 4,
                },
            ],
        });

        console.log(`✅ Created ${staff.count} staff members`);

        // Create sample shift templates
        console.log('📋 Creating sample shift templates...');

        const shiftTemplates = await prisma.shiftTemplate.createMany({
            data: [
                {
                    tenantKey: testTenantKey,
                    nome: 'Pranzo Sala',
                    oraInizio: '11:30',
                    oraFine: '15:30',
                    ruoloRichiesto: 'CAMERIERE',
                    giorniValidi: JSON.stringify([1, 2, 3, 4, 5, 6, 0]) as any, // Tutti i giorni
                },
                {
                    tenantKey: testTenantKey,
                    nome: 'Cena Sala',
                    oraInizio: '18:30',
                    oraFine: '23:30',
                    ruoloRichiesto: 'CAMERIERE',
                    giorniValidi: JSON.stringify([1, 2, 3, 4, 5, 6, 0]) as any,
                },
                {
                    tenantKey: testTenantKey,
                    nome: 'Cucina Pranzo',
                    oraInizio: '10:00',
                    oraFine: '16:00',
                    ruoloRichiesto: 'CUOCO',
                    giorniValidi: JSON.stringify([1, 2, 3, 4, 5, 6, 0]) as any,
                },
                {
                    tenantKey: testTenantKey,
                    nome: 'Cucina Cena',
                    oraInizio: '17:00',
                    oraFine: '00:00',
                    ruoloRichiesto: 'CUOCO',
                    giorniValidi: JSON.stringify([1, 2, 3, 4, 5, 6, 0]) as any,
                },
                {
                    tenantKey: testTenantKey,
                    nome: 'Bar Aperitivo',
                    oraInizio: '17:00',
                    oraFine: '21:00',
                    ruoloRichiesto: 'BARISTA',
                    giorniValidi: JSON.stringify([5, 6, 0]) as any, // Venerdì, Sabato, Domenica
                },
            ],
        });

        console.log(`✅ Created ${shiftTemplates.count} shift templates`);
    } else {
        console.log('ℹ️  Admin user already exists');
    }

    console.log('🎉 Seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

