const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for Seck Codou...");
    const staff = await prisma.staff.findFirst({
        where: {
            OR: [
                { nome: { contains: 'SECK', mode: 'insensitive' } },
                { cognome: { contains: 'SECK', mode: 'insensitive' } } // In case name/surname swapped
            ]
        }
    });

    if (!staff) {
        console.error("Seck Codou not found!");
        return;
    }
    console.log(`Found: ${staff.nome} ${staff.cognome} (ID: ${staff.id})`);

    // Week 42 Dates (Mon-Fri)
    // 13, 14, 15, 16, 17 Oct 2025
    const dates = [
        '2025-10-13', // Lun
        '2025-10-14', // Mar
        '2025-10-15', // Mer
        '2025-10-16', // Gio
        '2025-10-17'  // Ven
    ];

    for (const date of dates) {
        console.log(`Assigning ${date} 10:30-15:30...`);

        // Check existing to avoid duplication (or update)
        const existing = await prisma.assignment.findFirst({
            where: {
                staffId: staff.id,
                data: date,
                // Maybe check time? We'll just assume we want to OVERWRITE or ADD this specific shift.
                // If we want to replace, we should delete others? 
                // Let's Insert. The UI handles multiples.
            }
        });

        if (existing) {
            // Update existing to match request? Or skip?
            // User Request "Inserire i turni". implies "Make sure they are there".
            // Updating is safer to avoid duplicates if they ran it twice.
            await prisma.assignment.update({
                where: { id: existing.id },
                data: {
                    customStart: '10:30',
                    customEnd: '15:30',
                    postazione: 'BAR SU', // Defaulting to known station
                    stato: 'CONFIRMED'
                }
            });
            console.log(`Updated existing assignment ID ${existing.id}`);
        } else {
            await prisma.assignment.create({
                data: {
                    staffId: staff.id,
                    data: date,
                    customStart: '10:30',
                    customEnd: '15:30',
                    postazione: 'BAR SU',
                    stato: 'CONFIRMED'
                }
            });
            console.log("Created new assignment.");
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
