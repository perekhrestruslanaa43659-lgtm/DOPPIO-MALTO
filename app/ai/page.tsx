
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Bot, Send, Trash2, Settings, User, Cpu } from 'lucide-react';

interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
}

export default function AiAgentPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [apiKey, setApiKey] = useState(''); // Client side key if env not set
    const [showSettings, setShowSettings] = useState(false);

    // Cache for Context
    const [cachedData, setCachedData] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load Key
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiKey(savedKey);

        // Load History
        const savedChat = localStorage.getItem('ai_agent_chat');
        if (savedChat) {
            setMessages(JSON.parse(savedChat));
        } else {
            setMessages([{ sender: 'ai', text: '👋 Ciao! Sono il tuo assistente per i turni. Come posso aiutarti oggi?' }]);
        }

        loadContextData();
    }, []);

    useEffect(() => {
        if (messages.length > 0) localStorage.setItem('ai_agent_chat', JSON.stringify(messages));
        scrollToBottom();
    }, [messages, isTyping]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadContextData = async () => {
        setLoadingData(true);
        try {
            const [staff, coverage, assignments] = await Promise.all([
                api.getStaff(),
                api.getCoverage(),
                api.getSchedule('2024-01-01', '2025-12-31') // Broad range or current? Using broad for now
            ]);
            setCachedData({ staff, coverage, assignments });
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingData(false);
        }
    };

    const getSystemContext = () => {
        if (!cachedData) return "Sei un assistente per la gestione turni.";
        const { staff, coverage, assignments } = cachedData;

        return `Sei un assistente AI per un sistema di gestione turni di un ristorante.
        
DATI AGGIORNATI:
- Staff totale: ${staff?.length || 0}
- Postazioni attive: ${coverage?.filter((c: any) => c.enabled !== false).length || 0}
- Assegnazioni totali: ${assignments?.length || 0}

STAFF:
${staff?.slice(0, 10).map((s: any) => `- ${s.nome} ${s.cognome} (${s.ruolo})`).join('\n')}

Puoi rispondere a domande su orari, copertura e staff. Rispondi in italiano.`;
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const userText = input;
        setMessages(prev => [...prev, { sender: 'user', text: userText }]);
        setInput('');
        setIsTyping(true);

        try {
            // Construct History including System Prompt if it's the start
            // Logic: Backend adapts our { sender, text } list to Gemini history.
            // But we should inject System Prompt as the VERY FIRST message from 'user' or 'system' (Gemini uses 'user' for system instructions usually in history hack).

            // Actually, best practice: Send recent messages + Context.

            const contextMsg = { sender: 'user', text: getSystemContext() };
            const confirmMsg = { sender: 'ai', text: 'OK' }; // Mock confirmation

            // We prepend context to the history sent to API
            // But NOT to the UI state (messages)

            const historyToSend = [
                contextMsg,
                confirmMsg,
                ...messages, // Previous UI messages
                // formatted properly by backend map
            ];

            // @ts-ignore
            const res = await api.chat(userText, historyToSend, apiKey || undefined) as any;

            if (res.text) {
                setMessages(p => [...p, { sender: 'ai', text: res.text }]);
            } else if (res.error) {
                setMessages(p => [...p, { sender: 'ai', text: `❌ Errore: ${res.error}` }]);
            }

        } catch (e: any) {
            setMessages(p => [...p, { sender: 'ai', text: `❌ Errore Comunicazione: ${e.message}` }]);
        } finally {
            setIsTyping(false);
        }
    };

    const clearChat = () => {
        if (confirm("Cancellare la chat?")) {
            setMessages([{ sender: 'ai', text: 'Chat resettata.' }]);
            localStorage.removeItem('ai_agent_chat');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 rounded-t-xl text-white flex justify-between items-center shadow-lg shrink-0">
                <div className="flex items-center gap-3">
                    <Bot size={28} />
                    <div>
                        <h1 className="font-bold text-lg leading-tight">AI Shift Assistant</h1>
                        <p className="text-xs opacity-80">Powered by Gemini</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={clearChat} className="p-2 hover:bg-white/20 rounded-lg transition" title="Reset">
                        <Trash2 size={18} />
                    </button>
                    <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/20 rounded-lg transition" title="Settings">
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {/* Settings Drawer */}
            {showSettings && (
                <div className="bg-gray-100 p-4 border-b border-gray-200 text-sm">
                    <label className="block font-bold mb-1 ml-1 text-gray-700">API Key Personale (Opzionale se configurato server-side)</label>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            className="flex-1 p-2 border rounded"
                            placeholder="AIza..."
                            value={apiKey}
                            onChange={e => {
                                setApiKey(e.target.value);
                                localStorage.setItem('gemini_api_key', e.target.value);
                            }}
                        />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-1">Verrà usata al posto di quella del server.</p>
                </div>
            )}

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4 scroll-smooth">
                {loadingData && messages.length <= 1 && (
                    <div className="text-center p-4 text-gray-400 text-sm animate-pulse flex flex-col items-center">
                        <Cpu size={24} className="mb-2" />
                        Caricamento contesto dati...
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[80%] p-3 rounded-2xl shadow-sm relative text-sm md:text-base
                            ${m.sender === 'user'
                                ? 'bg-violet-600 text-white rounded-tr-sm'
                                : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'}
                        `}>
                            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white p-3 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 flex gap-1 items-center">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white p-4 border-t border-gray-200 rounded-b-xl shrink-0">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                >
                    <input
                        type="text"
                        className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm transition"
                        placeholder="Chiedi qualcosa..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={isTyping}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isTyping}
                        className="bg-violet-600 text-white p-3 rounded-full hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-md flex items-center justify-center w-12 h-12"
                    >
                        <Send size={20} className={isTyping ? 'opacity-0' : ''} />
                    </button>
                </form>
            </div>
        </div>
    );
}
