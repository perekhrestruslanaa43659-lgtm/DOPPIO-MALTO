
async function checkConfig() {
    try {
        const res = await fetch('http://localhost:1865/settings/llm_selected_configuration');
        if (!res.ok) {
            console.log("❌ Error fetching config:", res.status);
            return;
        }
        const data = await res.json();
        console.log("Current Config:", JSON.stringify(data, null, 2));
    } catch (e: any) {
        console.error("❌ Connection error:", e.message);
    }
}
checkConfig();
