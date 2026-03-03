
import fs from 'fs';
import path from 'path';

const files = [
    "README.md",
    "DEPLOY_FINAL.md",
    "GUIDA_DOMINIO.md",
    "QUICK_DEPLOY.md",
    "VERCEL_DEPLOYMENT.md",
    "VERCEL_CHECKLIST.md",
    "VERCEL_ENV_VARS.md",
    "VERCEL_LOGIN_STATUS.md",
    "CONFIGURAZIONE_DOMINIO.md",
    "SECURITY.md",
    "RESTART_BACKEND_GUIDE.md"
];

async function uploadFile(filename: string) {
    const filePath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`Skipping ${filename}: not found`);
        return;
    }

    console.log(`Uploading ${filename}...`);
    const fileContent = fs.readFileSync(filePath);

    // Node.js globals
    const blob = new Blob([fileContent], { type: 'text/markdown' });
    const formData = new FormData();
    formData.append('file', blob, filename);

    try {
        const res = await fetch('http://localhost:1865/rabbithole/', {
            method: 'POST',
            body: formData
        });

        let json;
        try {
            json = await res.json();
        } catch {
            json = await res.text();
        }

        console.log(`✅ Uploaded ${filename}: status ${res.status}`, json);
    } catch (e: any) {
        console.error(`❌ Failed to upload ${filename}:`, e.message);
    }
}

async function main() {
    console.log("Starting upload to Cheshire Cat Rabbit Hole...");

    // Check if Cat is up
    try {
        await fetch('http://localhost:1865/');
    } catch {
        console.error("❌ Cheshire Cat is not reachable at http://localhost:1865. Is Docker running?");
        return;
    }

    for (const file of files) {
        await uploadFile(file);
    }
    console.log("Done!");
}

main();
