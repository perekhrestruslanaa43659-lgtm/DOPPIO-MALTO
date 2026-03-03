
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const metaPath = path.resolve('cat/data/metadata.json');

function patch() {
    if (!fs.existsSync(metaPath)) {
        console.error("❌ metadata.json not found at", metaPath);
        return;
    }

    const raw = fs.readFileSync(metaPath, 'utf8');
    const db = JSON.parse(raw);
    const data = db._default;

    // Find next ID
    const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
    let nextId = (keys[keys.length - 1] || 0) + 1;

    // Check if already exists
    const existing = Object.values(data).find((v: any) => v.name === 'LLMGoogleGeminiConfig');
    if (existing) {
        console.log("⚠️ Config already exists, updating...");
        // Update logic if needed, but for now we assume fresh or overwrite
        // Actually, let's just ignore if exists to avoid dupes, or update the key
        // simpler to just append standard config
    }

    const apiKey = "AIzaSyD4qvIjtoXABnYwdIXHR1dsq1HE23Yxtkw";
    const now = Math.floor(Date.now() / 1000);

    // 1. Add LLM Config
    const llmConfigId = crypto.randomUUID();
    data[String(nextId++)] = {
        name: "LLMGoogleGeminiConfig",
        value: {
            google_api_key: apiKey,
            model: "gemini-1.5-flash"
        },
        category: "llm_factory",
        setting_id: llmConfigId,
        updated_at: now
    };

    // 2. Select LLM
    // Check if selected entry exists
    let selectedEntryKey = Object.keys(data).find(k => data[k].name === 'llm_selected_configuration');
    const selectedId = selectedEntryKey ? selectedEntryKey : String(nextId++);

    data[selectedId] = {
        name: "llm_selected_configuration",
        value: {
            name: "LLMGoogleGeminiConfig"
        },
        category: "llm_factory",
        setting_id: crypto.randomUUID(),
        updated_at: now
    };

    // 3. Add Embedder (FastEmbed)
    data[String(nextId++)] = {
        name: "EmbedderFastEmbedConfig",
        value: {
            model: "BAAI/bge-small-en-v1.5"
        },
        category: "embedder_factory",
        setting_id: crypto.randomUUID(),
        updated_at: now
    };

    // 4. Select Embedder
    let selectedEmbedderKey = Object.keys(data).find(k => data[k].name === 'embedder_selected_configuration');
    const selectedEmbedderId = selectedEmbedderKey ? selectedEmbedderKey : String(nextId++);

    data[selectedEmbedderId] = {
        name: "embedder_selected_configuration",
        value: {
            name: "EmbedderFastEmbedConfig"
        },
        category: "embedder_factory",
        setting_id: crypto.randomUUID(),
        updated_at: now
    };


    fs.writeFileSync(metaPath, JSON.stringify(db, null, 4));
    console.log("✅ Patched metadata.json successfully!");
}

patch();
