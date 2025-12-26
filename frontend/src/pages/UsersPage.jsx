import React, { useState, useEffect } from 'react';
import api from '../util/api';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ name: '', surname: '', email: '', password: '', role: 'USER' });
    const [showPassword, setShowPassword] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (e) {
            alert("Errore caricamento utenti: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Sei sicuro di voler eliminare questo utente?")) return;
        try {
            await api.deleteUser(id);
            loadUsers();
        } catch (e) {
            alert("Errore eliminazione: " + e.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.register(form);
            alert("✅ Utente creato con successo!");
            setForm({ name: '', surname: '', email: '', password: '', role: 'USER' });
            loadUsers();
        } catch (e) {
            alert("Errore creazione: " + e.message);
        }
    };

    const togglePassword = (userId) => {
        setShowPassword(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    const getInitials = (name, surname) => {
        const n = (name || '').charAt(0).toUpperCase();
        const s = (surname || '').charAt(0).toUpperCase();
        return n + s || '?';
    };

    const getAvatarColor = (id) => {
        const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
        return colors[id % colors.length];
    };

    const filteredUsers = users.filter(u =>
        (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    if (user.role !== 'ADMIN') {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            ❌ Accesso negato. Solo gli amministratori possono visualizzare questa pagina.
        </div>;
    }

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header con gradiente */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                padding: '30px',
                marginBottom: '30px',
                boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
                color: 'white'
            }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '2em' }}>👥 Gestione Utenti</h1>
                <p style={{ margin: 0, opacity: 0.9 }}>Gestisci gli utenti del sistema, monitora accessi e stato online</p>
            </div>

            {/* Form Creazione */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '25px',
                marginBottom: '30px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ marginTop: 0, color: '#333' }}>➕ Aggiungi Nuovo Utente</h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Nome *</label>
                            <input
                                type="text"
                                required
                                className="input"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Cognome</label>
                            <input
                                type="text"
                                className="input"
                                value={form.surname}
                                onChange={(e) => setForm({ ...form, surname: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Email *</label>
                            <input
                                type="email"
                                required
                                className="input"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Password *</label>
                            <input
                                type="password"
                                required
                                className="input"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Ruolo</label>
                            <select
                                className="input"
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            >
                                <option value="USER">USER</option>
                                <option value="ADMIN">ADMIN</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" className="btn" style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '12px 30px',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '1em'
                    }}>
                        ✨ Crea Utente
                    </button>
                </form>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="🔍 Cerca utente per nome, cognome o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '10px',
                        border: '2px solid #e0e0e0',
                        fontSize: '1em',
                        transition: 'border 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#667eea'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
            </div>

            {/* Tabella Utenti */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                    <div style={{ fontSize: '3em', marginBottom: '20px' }}>⏳</div>
                    <p>Caricamento utenti...</p>
                </div>
            ) : (
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#555' }}>Utente</th>
                                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#555' }}>Email</th>
                                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: 'bold', color: '#555' }}>Password</th>
                                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>Ruolo</th>
                                    <th style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#555' }}>Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(u => (
                                    <tr key={u.id} style={{
                                        borderBottom: '1px solid #f0f0f0',
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer'
                                    }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                    >
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    width: '45px',
                                                    height: '45px',
                                                    borderRadius: '50%',
                                                    background: getAvatarColor(u.id),
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold',
                                                    fontSize: '1.1em'
                                                }}>
                                                    {getInitials(u.name, u.surname)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', color: '#333' }}>
                                                        {u.name} {u.surname || ''}
                                                    </div>
                                                    <div style={{ fontSize: '0.85em', color: '#999' }}>
                                                        ID: {u.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px', color: '#555' }}>
                                            📧 {u.email}
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <code style={{
                                                    background: '#f5f5f5',
                                                    padding: '5px 10px',
                                                    borderRadius: '5px',
                                                    fontSize: '0.85em',
                                                    color: '#666',
                                                    maxWidth: '150px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {showPassword[u.id] ? u.password : '••••••••••••'}
                                                </code>
                                                <button
                                                    onClick={() => togglePassword(u.id)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: '1.3em',
                                                        padding: '5px'
                                                    }}
                                                    title={showPassword[u.id] ? 'Nascondi' : 'Mostra'}
                                                >
                                                    {showPassword[u.id] ? '🙈' : '👁️'}
                                                </button>
                                            </div>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <span style={{
                                                background: u.role === 'ADMIN' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#4caf50',
                                                color: 'white',
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                fontSize: '0.85em',
                                                fontWeight: 'bold',
                                                display: 'inline-block'
                                            }}>
                                                {u.role === 'ADMIN' ? '👑 ADMIN' : '👤 USER'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                style={{
                                                    background: '#f44336',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.background = '#d32f2f'}
                                                onMouseLeave={(e) => e.target.style.background = '#f44336'}
                                            >
                                                🗑️ Elimina
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredUsers.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                            <div style={{ fontSize: '3em', marginBottom: '20px' }}>🔍</div>
                            <p>Nessun utente trovato</p>
                        </div>
                    )}
                </div>
            )}

            {/* Footer Stats */}
            <div style={{
                marginTop: '30px',
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap'
            }}>
                <div style={{
                    flex: 1,
                    minWidth: '200px',
                    background: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2.5em', marginBottom: '10px' }}>👥</div>
                    <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#667eea' }}>{users.length}</div>
                    <div style={{ color: '#999', fontSize: '0.9em' }}>Utenti Totali</div>
                </div>
                <div style={{
                    flex: 1,
                    minWidth: '200px',
                    background: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2.5em', marginBottom: '10px' }}>👑</div>
                    <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#764ba2' }}>
                        {users.filter(u => u.role === 'ADMIN').length}
                    </div>
                    <div style={{ color: '#999', fontSize: '0.9em' }}>Amministratori</div>
                </div>
            </div>
        </div>
    );
}
