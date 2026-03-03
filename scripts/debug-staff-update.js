
const fs = require('fs');
const logStream = fs.createWriteStream('debug_output.txt');

function log(msg, obj) {
    const text = msg + (obj ? ' ' + JSON.stringify(obj, null, 2) : '') + '\n';
    console.log(msg, obj || '');
    logStream.write(text);
}

async function testUpdate() {
    // const fetch = require('node-fetch'); // Env has native fetch
    const baseUrl = 'http://localhost:3000/api/staff';
    const headers = {
        'Content-Type': 'application/json',
        'x-user-tenant-key': 'locale-test-doppio-malto'
    };

    log('--- 1. Fetching Staff ---');
    try {
        const res = await fetch(baseUrl, { headers });
        if (!res.ok) {
            log('Failed to fetch staff:', res.status);
            const txt = await res.text();
            log('Error body:', txt);
            return;
        }
        const staff = await res.json();
        log(`Fetched ${staff.length} staff members.`);

        if (staff.length > 0) {
            log('First staff member:', staff[0]);
        }

        // Check for Ahmed
        const user = staff.find(s => (s.nome + ' ' + (s.cognome || '')).toLowerCase().includes('ahmed'));

        if (!user) {
            log('Ahmed not found. List of names:');
            staff.forEach(s => log(`- ${s.nome} ${s.cognome || ''} (ID: ${s.id})`));
            return;
        }

        log(`Found User: ${user.nome} (ID: ${user.id})`);
        log(`Current Skill: ${user.skillLevel}`);

        log('\n--- 2. Updating Skill to SENIOR ---');
        const updatePayload = {
            skillLevel: 'SENIOR'
        };

        const updateRes = await fetch(`${baseUrl}?id=${user.id}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(updatePayload)
        });

        if (!updateRes.ok) {
            log('Update failed:', updateRes.status);
            const txt = await updateRes.text();
            log('Error body:', txt);
            return;
        }

        const updatedUser = await updateRes.json();
        log('Update Response:', updatedUser);

        log('\n--- 3. Verifying Update ---');
        const verifyRes = await fetch(baseUrl, { headers });
        const verifyStaff = await verifyRes.json();
        const verifiedUser = verifyStaff.find(s => s.id === user.id);
        log(`New Skill: ${verifiedUser.skillLevel}`);

    } catch (e) {
        log('Exception:', e.toString());
    } finally {
        logStream.end();
    }
}

testUpdate();
