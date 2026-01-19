const URL = 'http://localhost:4000/api';

async function main() {
    try {
        console.log("1. Logging in as Admin...");
        const loginRes = await fetch(`${URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@scheduling.com', password: 'admin' })
        });

        if (!loginRes.ok) {
            const err = await loginRes.text();
            throw new Error(`Login failed (${loginRes.status}): ${err}`);
        }

        const loginData = await loginRes.json();
        console.log("Login successful! Token:", loginData.token.substring(0, 20) + "...");
        const token = loginData.token;
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

        console.log("\n2. Fetching users (Initial)...");
        const list1 = await fetch(`${URL}/users`, { headers }).then(r => r.json());
        console.log("Users found:", list1.length);
        list1.forEach(u => console.log(`- ${u.id}: ${u.name} (${u.email}) [${u.role}]`));

        console.log("\n3. Creating new user 'TestDelete'...");
        const newRes = await fetch(`${URL}/register`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Test Delete',
                email: 'test@delete.com',
                password: 'password123',
                role: 'USER'
            })
        });

        if (!newRes.ok) {
            const err = await newRes.text();
            throw new Error(`Create failed (${newRes.status}): ${err}`);
        }

        const newData = await newRes.json();
        console.log("Created user ID:", newData.id);
        const newId = newData.id;

        console.log("\n4. Fetching users (After Create)...");
        const list2 = await fetch(`${URL}/users`, { headers }).then(r => r.json());
        console.log("Users found:", list2.length);
        if (list2.length !== list1.length + 1) console.error("ERROR: User count did not increase!");

        console.log(`\n5. Deleting user ID: ${newId}...`);
        const delRes = await fetch(`${URL}/users/${newId}`, { method: 'DELETE', headers });
        if (!delRes.ok) {
            const err = await delRes.text();
            throw new Error(`Delete failed (${delRes.status}): ${err}`);
        }
        console.log("Delete successful!");

        console.log("\n6. Fetching users (Final)...");
        const list3 = await fetch(`${URL}/users`, { headers }).then(r => r.json());
        console.log("Users found:", list3.length);

        if (list3.length === list1.length) {
            console.log("\nSUCCESS: User management flow verified!");
        } else {
            console.error("\nERROR: User count did not return to initial!");
        }

    } catch (e) {
        console.error("\nTEST FAILED:", e.message);
        if (e.cause) console.error(e.cause);
    }
}

main();
