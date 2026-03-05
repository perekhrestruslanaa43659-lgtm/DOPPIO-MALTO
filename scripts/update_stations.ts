import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting station rebranding: ACCOGLIENZA/ACC -> ACCGIU\'');

    const OLD_STATIONS = ['ACCOGLIENZA', 'ACC'];
    const NEW_STATION = 'ACCGIU\'';

    // 1. Update Staff postazioni (JSON array string)
    const staffs = await prisma.staff.findMany();
    let staffCount = 0;
    for (const s of staffs) {
        try {
            let postazioni: string[] = JSON.parse(s.postazioni || '[]');
            let changed = false;

            const updated = postazioni.map(p => {
                if (OLD_STATIONS.includes(p.toUpperCase().trim())) {
                    changed = true;
                    return NEW_STATION;
                }
                return p;
            });

            if (changed) {
                // Deduplicate
                const unique = Array.from(new Set(updated));
                await prisma.staff.update({
                    where: { id: s.id },
                    data: { postazioni: JSON.stringify(unique) }
                });
                staffCount++;
            }
        } catch (e) {
            console.error(`Error processing staff ${s.id}:`, e);
        }
    }
    console.log(`✅ Updated ${staffCount} staff members.`);

    // 2. Update Assignments
    const assignmentRes = await prisma.assignment.updateMany({
        where: {
            postazione: { in: OLD_STATIONS }
        },
        data: {
            postazione: NEW_STATION
        }
    });
    console.log(`✅ Updated ${assignmentRes.count} assignments.`);

    // 3. Update CoverageRows
    const coverageRes = await prisma.coverageRow.updateMany({
        where: {
            station: { in: OLD_STATIONS }
        },
        data: {
            station: NEW_STATION
        }
    });
    console.log(`✅ Updated ${coverageRes.count} coverage rows.`);

    // 4. Update RecurringShifts
    const recurringRes = await prisma.recurringShift.updateMany({
        where: {
            postazione: { in: OLD_STATIONS }
        },
        data: {
            postazione: NEW_STATION
        }
    });
    console.log(`✅ Updated ${recurringRes.count} recurring shifts.`);

    // 5. Update StaffCompetencies (Careful with unique constraint)
    const competencies = await prisma.staffCompetency.findMany({
        where: {
            postazione: { in: OLD_STATIONS }
        }
    });

    let compCount = 0;
    for (const tc of competencies) {
        try {
            // Check if the staff already has a record for the NEW_STATION
            const existing = await prisma.staffCompetency.findUnique({
                where: {
                    staffId_postazione: {
                        staffId: tc.staffId,
                        postazione: NEW_STATION
                    }
                }
            });

            if (existing) {
                // If it exists, we might want to keep the higher score or just delete the old one
                // Let's keep the higher score and delete the old one
                if (tc.score > existing.score) {
                    await prisma.staffCompetency.update({
                        where: { id: existing.id },
                        data: { score: tc.score, note: tc.note || existing.note }
                    });
                }
                await prisma.staffCompetency.delete({ where: { id: tc.id } });
            } else {
                await prisma.staffCompetency.update({
                    where: { id: tc.id },
                    data: { postazione: NEW_STATION }
                });
            }
            compCount++;
        } catch (e) {
            console.error(`Error processing competency ${tc.id}:`, e);
        }
    }
    console.log(`✅ Updated ${compCount} staff competencies.`);

    console.log('🏁 Rebranding complete!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
