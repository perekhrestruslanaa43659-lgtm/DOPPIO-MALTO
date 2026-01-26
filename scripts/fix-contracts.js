
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting contract type fix...");
    const allStaff = await prisma.staff.findMany();

    let updates = 0;

    for (const s of allStaff) {
        let newType = null;
        let newMax = null;

        const role = (s.ruolo || "").toLowerCase();

        if (role.includes("chiamata")) {
            newType = 'CHIAMATA';
            newMax = 0; // Ensure 0 for On-Call
        } else if (role.includes("tirocinante")) {
            newType = 'TIROCINANTE';
            // Max might differ, but let's leave existing max or default?
            // User didn't specify max for Tirocinante, usually they have fixed hours?
            // I'll only update contractType for Tirocinante unless their max is 0?
        }

        // If we identified a type and it is different from current
        if (newType && (s.contractType !== newType || (newMax !== null && s.oreMassime !== newMax))) {
            const data = { contractType: newType };
            if (newMax !== null) data.oreMassime = newMax;

            await prisma.staff.update({
                where: { id: s.id },
                data: data
            });
            console.log(`UPDATED: ${s.nome} ${s.cognome} (${s.ruolo}) -> ${newType} [Max: ${newMax !== null ? newMax : s.oreMassime}]`);
            updates++;
        }
    }

    console.log(`Done. Updated ${updates} staff members.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
