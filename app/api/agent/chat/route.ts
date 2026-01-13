
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message, history, apiKey: clientApiKey } = body;

        // Use client provided key OR server env key
        const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'API Key not found. Please configure it in settings.' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        // history format from frontend: { role: 'user'|'model', parts: [{ text: string }] }
        // We might need to adapt if frontend sends different format.
        // Legacy sends: { sender: 'user'|'ai', text: string }
        // We should adapt legacy messages to Gemini history format.

        let geminiHistory: any[] = [];
        if (Array.isArray(history)) {
            geminiHistory = history.map((msg: any) => ({
                role: msg.sender === 'ai' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            }));
        }

        // Start chat
        const chat = model.startChat({
            history: geminiHistory,
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ text });
    } catch (error: any) {
        console.error('AI Error:', error);
        return NextResponse.json({ error: error.message || 'Error processing AI request' }, { status: 500 });
    }
}
