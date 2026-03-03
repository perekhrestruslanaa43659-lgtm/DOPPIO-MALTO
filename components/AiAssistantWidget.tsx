'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Bot, Send, Trash2, Settings, Wifi, WifiOff, FileUp, X, MessageSquare, Minimize2 } from 'lucide-react';

interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
}

type AiMode = 'gemini' | 'cheshire_cat';

export default function AiAssistantWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    // Mode Selection
    const [aiMode, setAiMode] = useState<AiMode>('cheshire_cat');

    // Cheshire Cat State
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [wsError, setWsError] = useState<string | null>(null);

    // Gemini Context
    const [cachedData, setCachedData] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- EFFECT: Init & Load ---
    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiKey(savedKey);

        const savedMode = localStorage.getItem('ai_agent_mode') as AiMode;
        if (savedMode) setAiMode(savedMode);

        const savedChat = localStorage.getItem('ai_agent_chat');
        if (savedChat) {
            setMessages(JSON.parse(savedChat));
        } else {
            setMessages([{ sender: 'ai', text: '👋 Ciao! Sono il tuo assistente per i turni. Come posso aiutarti oggi?' }]);
        }

        loadContextData();
    }, []);

    // --- EFFECT: WebSocket Connection for Cat ---
    useEffect(() => {
        if (aiMode === 'cheshire_cat') {
            connectToCat();
        }

        return () => {
            if (socket) {
                console.log('[Widget] Cleanup: Closing socket');
                socket.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aiMode]);

    // --- EFFECT: Save History & Scroll ---
    useEffect(() => {
        if (messages.length > 0) localStorage.setItem('ai_agent_chat', JSON.stringify(messages));
        if (isOpen) scrollToBottom();
    }, [messages, isTyping, isOpen]);

    const connectToCat = () => {
        try {
            if (socket) {
                socket.close();
            }

            const port = 1866;
            console.log(`[Widget] Connecting to Cheshire Cat on port ${port}...`);

            const ws = new WebSocket(`ws://localhost:${port}/ws`);

            ws.onopen = () => {
                console.log(`[Widget] Connected to Cheshire Cat`);
                setIsConnected(true);
                setWsError(null);
                // setMessages(prev => [...prev, { sender: 'ai', text: `😺 Connesso a Stregatto` }]);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.text) {
                    setMessages(prev => [...prev, { sender: 'ai', text: data.text }]);
                    setIsTyping(false);
                }
            };

            ws.onclose = () => {
                console.log('[Widget] Disconnected from Cheshire Cat');
                setIsConnected(false);
            };

            ws.onerror = (err) => {
                console.error('[Widget] WebSocket Error:', err);
                setWsError(`Impossibile connettersi allo Stregatto (localhost:${port}). Assicurati che Docker sia attivo.`);
                setIsConnected(false);
            };

            setSocket(ws);
        } catch (e) {
            console.error(e);
            setWsError('Errore inizializzazione WebSocket.');
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const loadContextData = async () => {
        if (aiMode === 'cheshire_cat') {
            setLoadingData(false);
            return;
        }

        setLoadingData(true);
        try {
            const [staff, coverage, assignments] = await Promise.all([
                api.getStaff(),
                api.getCoverage(),
                api.getSchedule('2024-01-01', '2025-12-31')
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
            if (aiMode === 'cheshire_cat') {
                if (!socket || socket.readyState !== WebSocket.OPEN) {
                    const port = 1866;
                    setMessages(p => [...p, { sender: 'ai', text: `⚠️ Errore: Non connesso allo Stregatto (Port ${port}). Controlla Docker.` }]);
                    setIsTyping(false);
                    connectToCat();
                    return;
                }

                socket.send(JSON.stringify({
                    text: userText
                }));
            } else {
                const contextMsg = { sender: 'user', text: getSystemContext() };
                // const confirmMsg = { sender: 'ai', text: 'OK' }; // Removed to avoid Model->Model turn error

                const historyToSend = [
                    contextMsg,
                    // confirmMsg,
                    ...messages,
                ];

                // @ts-ignore
                const res = await api.chat(userText, historyToSend, apiKey || undefined) as any;

                if (res.text) {
                    setMessages(p => [...p, { sender: 'ai', text: res.text }]);
                } else if (res.error) {
                    setMessages(p => [...p, { sender: 'ai', text: `❌ Errore: ${res.error}` }]);
                }
                setIsTyping(false);
            }

        } catch (e: any) {
            setMessages(p => [...p, { sender: 'ai', text: `❌ Errore Comunicazione: ${e.message}` }]);
            setIsTyping(false);
        }
    };

    const clearChat = () => {
        if (confirm("Cancellare la chat?")) {
            setMessages([{ sender: 'ai', text: 'Chat resettata.' }]);
            localStorage.removeItem('ai_agent_chat');
        }
    };

    const changeMode = (mode: AiMode) => {
        setAiMode(mode);
        localStorage.setItem('ai_agent_mode', mode);
        setMessages(prev => [...prev, { sender: 'ai', text: `🔄 Modalità cambiata in: ${mode === 'cheshire_cat' ? 'Cheshire Cat (Locale)' : 'Gemini (Cloud)'}` }]);

        if (mode === 'gemini' && !cachedData) {
            loadContextData();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 p-4 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-2xl transition-all hover:scale-110 flex items-center justify-center group"
                title="Apri Assistente AI"
            >
                <Bot size={28} className="group-hover:animate-pulse" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 animate-in slide-in-from-bottom-10 fade-in duration-300">
            {/* Header */}
            <div className={`
                p-4 text-white flex justify-between items-center shadow-md shrink-0 transition-colors duration-500 cursor-move
                ${aiMode === 'cheshire_cat'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600'}
            `}>
                <div className="flex items-center gap-2">
                    <Bot size={24} />
                    <div>
                        <h1 className="font-bold text-base leading-tight">
                            {aiMode === 'cheshire_cat' ? `Stregatto AI` : 'AI Assistant'}
                        </h1>
                        <p className="text-[10px] opacity-90 flex items-center gap-1">
                            {aiMode === 'cheshire_cat' ? (
                                isConnected ? <><Wifi size={8} /> Online</> : <><WifiOff size={8} /> Offline</>
                            ) : (
                                'Gemini 1.5'
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-1">
                    {aiMode === 'cheshire_cat' && (
                        <a
                            href={`http://localhost:1866/admin`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-white/20 rounded-lg transition"
                            title="Admin Panel"
                        >
                            <FileUp size={16} />
                        </a>
                    )}
                    <button onClick={clearChat} className="p-1.5 hover:bg-white/20 rounded-lg transition" title="Reset Chat">
                        <Trash2 size={16} />
                    </button>
                    <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 hover:bg-white/20 rounded-lg transition" title="Settings">
                        <Settings size={16} />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition" title="Close">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Settings Drawer */}
            {showSettings && (
                <div className="bg-gray-50 p-4 border-b border-gray-200 text-sm animate-fade-in-down">
                    <div className="mb-3">
                        <label className="block font-bold mb-2 text-gray-700 text-xs uppercase tracking-wide">Modalità AI</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => changeMode('cheshire_cat')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${aiMode === 'cheshire_cat' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white border border-gray-200 hover:bg-gray-100 text-gray-600'}`}
                            >
                                🐱 Stregatto
                            </button>
                            <button
                                onClick={() => changeMode('gemini')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${aiMode === 'gemini' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-gray-200 hover:bg-gray-100 text-gray-600'}`}
                            >
                                💎 Gemini
                            </button>
                        </div>
                    </div>

                    {aiMode === 'gemini' && (
                        <div>
                            <label className="block font-bold mb-1 text-gray-700 text-xs">API Key (Gemini)</label>
                            <input
                                type="password"
                                className="w-full p-2 border rounded text-xs"
                                placeholder="AIza..."
                                value={apiKey}
                                onChange={e => {
                                    setApiKey(e.target.value);
                                    localStorage.setItem('gemini_api_key', e.target.value);
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 space-y-3 scroll-smooth">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[85%] p-2.5 rounded-2xl shadow-sm relative text-sm
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
                        <div className="bg-white p-2.5 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white p-3 border-t border-gray-200 shrink-0">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                >
                    <input
                        type="text"
                        className="flex-1 p-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm transition bg-gray-50 focus:bg-white"
                        placeholder={aiMode === 'cheshire_cat' && !isConnected ? "Connessione..." : "Scrivi qui..."}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={isTyping || (aiMode === 'cheshire_cat' && !isConnected)}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isTyping || (aiMode === 'cheshire_cat' && !isConnected)}
                        className={`
                            text-white p-2 rounded-full shadow-md flex items-center justify-center w-10 h-10 transition shrink-0
                            ${!input.trim() || isTyping || (aiMode === 'cheshire_cat' && !isConnected)
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-violet-600 hover:bg-violet-700'}
                        `}
                    >
                        <Send size={18} className={isTyping ? 'opacity-0' : ''} />
                    </button>
                </form>
            </div>
        </div>
    );
}
