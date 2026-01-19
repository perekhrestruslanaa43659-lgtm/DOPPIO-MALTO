const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SERVER_URL = 'http://localhost:4000/api';

async function testWorkflow() {
    console.log("Starting Draft/Publish Workflow Test...");

    // 1. Setup Data
    const date = '2025-11-20'; // Future date
    const staff = await prisma.staff.findFirst();
    if (!staff) { console.log("No staff found."); return; }

    console.log(`Using Staff: ${staff.nome} (ID: ${staff.id})`);

    // Cleanup
    await prisma.assignment.deleteMany({ where: { data: date } });

    // 2. Create Assignment via API (or mimicking Creation)
    // We'll mimic the "Availability" endpoint creation which sets status: false
    // Or just Create directly via Prisma as Draft
    console.log("Creating Draft Assignment...");
    const draft = await prisma.assignment.create({
        data: {
            staffId: staff.id,
            data: date,
            start_time: '09:00',
            end_time: '14:00',
            status: false // BOZZA
        }
    });
    console.log(`Draft Created: ID ${draft.id}, Status: ${draft.status}`);

    if (draft.status !== false) {
        console.error("FAIL: Created assignment is not Draft (false).");
        return;
    }

    // 3. Call Publish API
    console.log("Calling /api/assignments/publish...");
    const response = await fetch(`${SERVER_URL}/assignments/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            startDate: date,
            endDate: date
        })
    });

    const result = await response.json();
    console.log("Publish Result:", result);

    if (result.count < 1) {
        console.error("FAIL: Publish count is 0.");
        return;
    }

    // 4. Verify DB
    const updated = await prisma.assignment.findUnique({ where: { id: draft.id } });
    console.log(`Updated Assignment: ID ${updated.id}, Status: ${updated.status}`);

    if (updated.status === true) {
        console.log("SUCCESS: Assignment published!");
    } else {
        console.error("FAIL: Assignment status is still false.");
    }
}

testWorkflow()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
