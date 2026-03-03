
async function listSettings() {
    try {
        const res = await fetch('http://localhost:1865/settings/');
        if (!res.ok) {
            console.log("❌ Error fetching settings root:", res.status);
            return;
        }
        const data = await res.json();
        console.log("Available Settings:", JSON.stringify(data, null, 2));
    } catch (e: any) {
        console.error("❌ Connection error:", e.message);
    }
}
listSettings();
