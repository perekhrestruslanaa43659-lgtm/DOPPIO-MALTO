import api from '../util/api'

export default function AiAgentPage() {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef(null)

    // Load history
    useEffect(() => {
        const saved = localStorage.getItem('ai_agent_chat')
        if (saved) {
            setMessages(JSON.parse(saved))
        } else {
            setMessages([
                { sender: 'ai', text: 'Ciao! Sono il tuo assistente per la pianificazione. Come posso aiutarti oggi?' }
            ])
        }
    }, [])

    // Save history
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('ai_agent_chat', JSON.stringify(messages))
        }
    }, [messages])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isTyping])

    const handleSend = async () => {
        if (!input.trim()) return

        const userMsg = { sender: 'user', text: input }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsTyping(true)

        try {
            const res = await api.chat(userMsg.text)
            const aiMsg = { sender: 'ai', text: res.response || "Risposta vuota dal server." }
            setMessages(prev => [...prev, aiMsg])
        } catch (e) {
            setMessages(prev => [...prev, { sender: 'ai', text: "⚠️ Errore di connessione: " + e.message }])
        } finally {
            setIsTyping(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSend()
    }

    const clearChat = () => {
        if (confirm("Vuoi cancellare tutta la conversazione?")) {
            setMessages([{ sender: 'ai', text: 'Chat resettata. Dimmi pure.' }])
            localStorage.removeItem('ai_agent_chat')
        }
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
                        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Always online</span>
                    </div>
                </div>
                <button
                    onClick={clearChat}
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '5px 10px', borderRadius: '5px' }}
                >
                    Clear History
                </button>
            </div>

            {/* Chat Body */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f5f7fb' }}>
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
                            lineHeight: '1.5'
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
                            Sta scrivendo...
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
                <input
                    className="input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Chiedi qualcosa sui turni..."
                    style={{ flex: 1, padding: '12px', borderRadius: '25px', border: '1px solid #ddd', fontSize: '1rem' }}
                />
                <button
                    className="btn"
                    onClick={handleSend}
                    style={{
                        borderRadius: '50%', width: '50px', height: '50px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#764ba2', color: 'white', fontSize: '1.2rem', padding: 0
                    }}
                >
                    ➤
                </button>
            </div>
        </div>
    )
}
