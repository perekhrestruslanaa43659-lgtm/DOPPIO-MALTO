// Native fetch is available in Node 18+

async function testPort(port) {
    const url = `http://127.0.0.1:${port}`;
    try {
        await fetch(url);
        return url;
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('=== TEST SQLITE API ===');

    let BASE_URL = await testPort(3001);
    // If not found, try 3000
    if (!BASE_URL) BASE_URL = await testPort(3000);

    if (!BASE_URL) {
        console.error('❌ Could not connect to localhost:3000 or localhost:3001. Is server running?');
        return;
    }

    console.log(`✅ Server found at ${BASE_URL}`);

    // 1. Login
    console.log('1. Logging in...');
    try {
        const loginRes = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@doppiomalto.test', password: 'admin123' })
        });

        if (!loginRes.ok) {
            console.error('Login Failed:', await loginRes.text());
            return;
        }

        const cookie = loginRes.headers.get('set-cookie');
        console.log('✅ Login OK. Cookie obtained.');

        // 2. Save Forecast
        const weekStart = '2026-01-12'; // Week 3 2026
        console.log(`2. Saving Forecast for ${weekStart}...`);

        // Create dummy 10x10 grid string
        const dummyData = JSON.stringify(Array(10).fill(Array(10).fill("TEST_PERSISTENCE_WEEK3")));

        const saveRes = await fetch(`${BASE_URL}/api/forecast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },
            body: JSON.stringify([{ weekStart, data: dummyData }])
        });

        if (!saveRes.ok) {
            console.error('Save Failed:', await saveRes.text());
            return;
        }
        console.log('✅ Save API responded OK');

        // 3. Load Forecast via API
        console.log(`3. Loading Forecast for ${weekStart}...`);
        const loadRes = await fetch(`${BASE_URL}/api/forecast?start=${weekStart}&end=${weekStart}`, {
            method: 'GET',
            headers: {
                'Cookie': cookie,
            }
        });

        if (!loadRes.ok) {
            console.error('Load Failed:', await loadRes.text());
            return;
        }

        const loadedData = await loadRes.json();
        console.log(`✅ Load API responded. Records found: ${loadedData.length}`);

        if (loadedData.length > 0 && loadedData[0].weekStart === weekStart) {
            console.log('🎉 SUCCESS! Data persisted and retrieved.');
            const parsed = JSON.parse(loadedData[0].data);
            if (parsed[0][0] === "TEST_PERSISTENCE_WEEK3") {
                console.log('   Content Verification: OK');
            } else {
                console.log('   Content Verification: FAILED (Data mismatch)');
            }
        } else {
            console.log('❌ FAILURE! loadedData:', JSON.stringify(loadedData));
        }
    } catch (e) {
        console.error('❌ Script Error:', e);
    }
}

main().catch(console.error);
