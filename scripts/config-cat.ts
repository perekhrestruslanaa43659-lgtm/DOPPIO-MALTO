
async function configureCat() {
    const apiKey = "AIzaSyD4qvIjtoXABnYwdIXHR1dsq1HE23Yxtkw";

    console.log("Configuring Cheshire Cat with Gemini...");

    // 1. Select LLM Factory
    try {
        const res = await fetch('http://localhost:1865/settings/llm_selected_configuration', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "LLMGoogleGeminiConfig",
                value: {
                    google_api_key: apiKey,
                    model: "gemini-1.5-flash"
                }
            })
        });

        if (res.ok) console.log("✅ LLM Configured Successfully!");
        else console.error("❌ Failed to config LLM:", await res.text());

    } catch (e: any) {
        console.error("❌ Error:", e.message);
    }

    // 2. Configure Embedder (FastEmbed is default usually, ensuring it's set)
    try {
        const res = await fetch('http://localhost:1865/settings/embedder_selected_configuration', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "EmbedderFastEmbedConfig",
                value: {
                    model: "BAAI/bge-small-en-v1.5"
                }
            })
        });

        if (res.ok) console.log("✅ Embedder Configured (FastEmbed)!");
    } catch (e) {
        // Ignore embedder error if already set
    }
}

configureCat();
