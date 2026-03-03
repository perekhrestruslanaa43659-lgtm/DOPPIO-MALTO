
async function findLlmSetting() {
    try {
        const res = await fetch('http://localhost:1865/settings/');
        const data = await res.json();
        const settings = data.settings || [];

        const llmSetting = settings.find((s: any) => s.name.includes('llm') || s.name.includes('LLM'));

        if (llmSetting) {
            console.log("✅ Found LLM Setting:", JSON.stringify(llmSetting, null, 2));
        } else {
            console.log("❌ No LLM setting found in list. Available names:", settings.map((s: any) => s.name).join(', '));
        }
    } catch (e: any) {
        console.error("❌ Error:", e.message);
    }
}
findLlmSetting();
