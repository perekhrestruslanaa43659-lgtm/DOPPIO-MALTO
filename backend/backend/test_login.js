// Node.js 18+ has native fetch

async function testLogin() {
    console.log('🧪 Testing Login Endpoint...\n');

    const url = 'http://localhost:4000/api/login';
    const credentials = {
        email: 'admin@scheduling.local',
        password: 'admin123'
    };

    try {
        console.log(`POST ${url}`);
        console.log('Body:', JSON.stringify(credentials, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        console.log('\nResponse Status:', response.status, response.statusText);

        const data = await response.json();
        console.log('Response Body:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ Login successful!');
            console.log('Token received:', data.token ? 'Yes' : 'No');
        } else {
            console.log('\n❌ Login failed');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testLogin();
