const URL = 'http://localhost:4000/api';

async function main() {
    try {
        console.log("1. Logging in as Admin...");
        const loginRes = await fetch(`${URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@scheduling.com', password: 'admin' })
        });

        if (!loginRes.ok) throw new Error("Admin login failed");
        const { token } = await loginRes.json();
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

        console.log("2. Creating user 'rusliperekhrest'...");
        const res = await fetch(`${URL}/register`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Ruslana',
                email: 'rusliperekhrest@gmail.com',
                password: 'RUSLANA2026',
                role: 'USER'
            })
        });

        if (res.ok) {
            console.log("SUCCESS: User created successfully!");
        } else {
            console.log("Response:", await res.text());
        }

    } catch (e) {
        console.error("ERROR:", e.message);
    }
}

main();
