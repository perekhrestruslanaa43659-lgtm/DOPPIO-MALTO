import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import api from '../util/api';

export default function AiAgentPage() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || 'AIzaSyBKlCTyfNPc2eODYG84D55ZmAzJd5RV6EA');
    const [showSettings, setShowSettings] = useState(false);
    const [cachedData, setCachedData] = useState(null);
    const [dataLoading, setDataLoading] = useState(true);
    const messagesEndRef = useRef(null);

    // Preload all data when component mounts
    useEffect(() => {
        const loadAllData = async () => {
            setDataLoading(true);
            try {
                const [staff, coverage, assignments] = await Promise.all([
                    api.getStaff().catch(() => []),
                    api.getCoverage().catch(() => []),
                    api.getAssignments().catch(() => [])
                ]);

                setCachedData({
                    staff,
                    coverage,
                    assignments,
                    loadedAt: new Date().toISOString()
                });
            } catch (e) {
                console.error('Error loading data:', e);
                setCachedData({ staff: [], coverage: [], assignments: [], loadedAt: null });
            } finally {
                setDataLoading(false);
            }
        };

        loadAllData();
    }, []);

    // Load history
    useEffect(() => {
        const saved = localStorage.getItem('ai_agent_chat');
        if (saved) {
            setMessages(JSON.parse(saved));
        } else {
            setMessages([
                { sender: 'ai', text: '👋 Ciao! Sono il tuo assistente AI per la gestione dei turni.\n\nPosso aiutarti con:\n• Informazioni su staff e turni\n• Analisi ore e copertura\n• Suggerimenti per la pianificazione\n\nCosa posso fare per te?' }
            ]);
        }
    }, []);

    // Save history
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('ai_agent_chat', JSON.stringify(messages));
        }
    }, [messages]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const getSystemContext = async () => {
        if (!cachedData) {
            return 'Sei un assistente AI per la gestione turni di un ristorante. Rispondi in italiano.';
        }

        const { staff, coverage, assignments } = cachedData;

        // Calculate some useful stats
        const totalStaff = staff.length;
        const totalStations = coverage.length;
        const enabledStations = coverage.filter(c => c.enabled !== false).length;
        const totalAssignments = assignments.length;

        return `Sei un assistente AI per un sistema di gestione turni di un ristorante.

DATI CORRENTI (aggiornati automaticamente):
- Staff totale: ${totalStaff} persone
- Postazioni configurate: ${totalStations} (${enabledStations} attive)
- Turni assegnati: ${totalAssignments}

STAFF DISPONIBILE:
${staff.slice(0, 10).map(s => `- ${s.name || s.email} (${s.role || 'USER'})`).join('\n')}
${staff.length > 10 ? `... e altri ${staff.length - 10} membri` : ''}

POSTAZIONI ATTIVE:
${coverage.filter(c => c.enabled !== false).slice(0, 8).map(c => `- ${c.station}`).join('\n')}
${enabledStations > 8 ? `... e altre ${enabledStations - 8} postazioni` : ''}

CAPACITÀ:
1. Rispondere a domande sui dati (staff, turni, postazioni)
2. Analizzare ore e copertura
3. Suggerire ottimizzazioni
4. Fornire statistiche e report

REGOLE TURNI:
- Turno Pranzo: generalmente 12:00-18:00
- Turno Sera: generalmente 18:00-01:00 (weekend fino 02:00)
- Rispetta vincoli ore settimanali per persona
- Considera disponibilità e preferenze staff

ISTRUZIONI:
- Rispondi in italiano, in modo chiaro e conciso
- Usa i dati forniti per dare risposte accurate
- Se non hai abbastanza informazioni, chiedi chiarimenti
- Fornisci suggerimenti pratici e attuabili

Sei pronto ad aiutare con la gestione dei turni!`;
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        if (!apiKey) {
            setShowSettings(true);
            return;
        }

        const userMsg = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

            const systemContext = await getSystemContext();
            const chat = model.startChat({
                history: [
                    {
                        role: 'user',
                        parts: [{ text: systemContext }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: 'Capito! Sono pronto ad aiutarti con la gestione dei turni.' }]
                    }
                ]
            });

            const result = await chat.sendMessage(input);
            const response = await result.response;
            const text = response.text();

            const aiMsg = { sender: 'ai', text };
            setMessages(prev => [...prev, aiMsg]);
        } catch (e) {
            console.error('AI Error:', e);
            let errorMsg = '❌ Errore: ';

            if (e.message && e.message.includes('API key not valid')) {
                errorMsg += 'API key non valida. Per favore:\n\n1. Vai su https://makersuite.google.com/app/apikey\n2. Crea una nuova API key\n3. Clicca su "⚙️ Settings" e inserisci la nuova chiave\n\nAssicurati che l\'API key sia attiva e non abbia restrizioni.';
            } else if (e.message && e.message.includes('quota')) {
                errorMsg += 'Limite di richieste raggiunto. Riprova tra qualche minuto.';
            } else {
                errorMsg += e.message || 'Errore di connessione. Verifica la tua connessione internet e riprova.';
            }

            setMessages(prev => [...prev, {
                sender: 'ai',
                text: errorMsg
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const clearChat = () => {
        if (confirm("Vuoi cancellare tutta la conversazione?")) {
            setMessages([{ sender: 'ai', text: '👋 Chat resettata! Come posso aiutarti?' }]);
            localStorage.removeItem('ai_agent_chat');
        }
    };

    const saveApiKey = () => {
        localStorage.setItem('gemini_api_key', apiKey);
        setShowSettings(false);
    };

    if (showSettings) {
        return (
            <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
                <h2>⚙️ Configurazione AI Assistant</h2>
                <p>Per usare l'AI Assistant, hai bisogno di una API key di Google Gemini.</p>

                <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                    <h3>📝 Come ottenere la API Key:</h3>
                    <ol>
                        <li>Vai su <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#2196f3' }}>Google AI Studio</a></li>
                        <li>Accedi con il tuo account Google</li>
                        <li>Clicca su "Create API Key"</li>
                        <li>Copia la chiave e incollala qui sotto</li>
                    </ol>
                    <p><strong>Nota:</strong> Gemini Pro è gratuito fino a 60 richieste/minuto!</p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                        API Key Gemini:
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIza..."
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '1em',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={saveApiKey}
                        disabled={!apiKey}
                        style={{
                            padding: '12px 24px',
                            background: apiKey ? '#4caf50' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '1em',
                            cursor: apiKey ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold'
                        }}
                    >
                        💾 Salva e Inizia
                    </button>
                    {apiKey && (
                        <button
                            onClick={() => setShowSettings(false)}
                            style={{
                                padding: '12px 24px',
                                background: '#607d8b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '1em',
                                cursor: 'pointer'
                            }}
                        >
                            ← Torna alla Chat
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)',
            maxWidth: '900px', margin: '0 auto', background: '#fff',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden'
        }}>

            {/* Header */}
            <div style={{
                padding: '15px 20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '1.5rem' }}>🤖</div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>AI Shift Assistant</h2>
                        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Powered by Gemini</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={clearChat}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '5px 10px', borderRadius: '5px' }}
                    >
                        🔄 Reset
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '5px 10px', borderRadius: '5px' }}
                    >
                        ⚙️ Settings
                    </button>
                </div>
            </div>

            {/* Chat Body */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f5f7fb' }}>
                {dataLoading && (
                    <div style={{
                        background: '#fff3e0',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        textAlign: 'center',
                        color: '#e65100',
                        fontSize: '0.95em',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ marginBottom: '5px', fontSize: '1.3em' }}>⏳</div>
                        <div style={{ fontWeight: 'bold' }}>Caricamento dati in corso...</div>
                        <div style={{ fontSize: '0.85em', marginTop: '3px', opacity: 0.8 }}>
                            Sto recuperando staff, postazioni e turni
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
                        marginBottom: '15px'
                    }}>
                        <div style={{
                            maxWidth: '70%',
                            padding: '12px 16px',
                            borderRadius: '18px',
                            borderTopLeftRadius: m.sender === 'ai' ? '4px' : '18px',
                            borderTopRightRadius: m.sender === 'user' ? '4px' : '18px',
                            background: m.sender === 'user' ? '#667eea' : '#fff',
                            color: m.sender === 'user' ? 'white' : '#333',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            lineHeight: '1.5',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {m.text}
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '15px' }}>
                        <div style={{
                            background: '#fff', padding: '12px 16px', borderRadius: '18px',
                            borderTopLeftRadius: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            color: '#888', fontStyle: 'italic'
                        }}>
                            💭 Sto pensando...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{
                padding: '20px', background: 'white', borderTop: '1px solid #eee',
                display: 'flex', gap: '10px'
            }}>
                <textarea
                    className="input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Chiedi qualcosa sui turni... (Shift+Enter per nuova riga)"
                    style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '25px',
                        border: '1px solid #ddd',
                        fontSize: '1rem',
                        resize: 'none',
                        minHeight: '50px',
                        maxHeight: '120px'
                    }}
                />
                <button
                    className="btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    style={{
                        borderRadius: '50%', width: '50px', height: '50px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: input.trim() && !isTyping ? '#764ba2' : '#ccc',
                        color: 'white',
                        fontSize: '1.2rem',
                        padding: 0,
                        cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed'
                    }}
                >
                    {isTyping ? '⏳' : '➤'}
                </button>
            </div>
        </div>
    );
}
