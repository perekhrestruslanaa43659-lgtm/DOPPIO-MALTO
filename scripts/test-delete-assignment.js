
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Create a dummy assignment
    const staff = await prisma.staff.findFirst();
    if (!staff) throw new Error("No staff found");

    const asn = await prisma.assignment.create({
        data: {
            staffId: staff.id,
            data: '2026-01-01',
            start_time: '12:00',
            end_time: '13:00',
            postazione: 'TEST_DEL',
            tenantKey: staff.tenantKey
        }
    });
    console.log(`Created dummy assignment ${asn.id}`);

    // 2. Try to delete it (Simulate API logic essentially)
    console.log(`Deleting assignment ${asn.id}...`);
    try {
        const deleted = await prisma.assignment.delete({
            where: { id: asn.id }
        });
        console.log("Delete successful:", deleted.id);
    } catch (e) {
        console.error("Delete failed:", e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
