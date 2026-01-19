const API_URL = 'http://localhost:4000/api';

async function run() {
    console.log("Attempting to save Ruslana (ID 50) range Dec 23-26...");

    const payload = {
        staffId: 50, // Ruslana
        startDate: '2025-12-23', // From "Dal"
        endDate: '2025-12-26',   // To "Al"
        startTime: '18:00',
        endTime: '01:00',
        type: 'RANGE',
        scope: 'daily_range',
        reason: '',
        dayIndex: 2, // Wednesday (Source date in modal was Wed 15/10), but target is new dates.
        // The backend loop uses curr.getDay() if weekly, but daily_range just loops.
        suffix: 'S',  // Sera
        force: false  // Simulate first try
    };

    try {
        const res = await fetch(`${API_URL}/availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("Response Status:", res.status);
        console.log("Response Data:", JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

run();
