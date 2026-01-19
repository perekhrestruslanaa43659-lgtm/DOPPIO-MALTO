import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../util/api';
import { Eye, EyeOff, User, Save, Shield } from 'lucide-react';

export default function ProfilePage() {
    const { user, login } = useAuth();
    const [form, setForm] = useState({
        name: '',
        surname: '',
        email: '',
        dob: '',
        address: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (user) loadProfile();
    }, [user]);

    const loadProfile = async () => {
        try {
            const profile = await api.getProfile();
            setForm({
                name: profile.name || '',
                surname: profile.surname || '',
                email: profile.email || user.email || '',
                dob: profile.dob || '',
                address: profile.address || '',
                password: ''
            });
        } catch (e) {
            console.error("Profile load failed", e);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                name: form.name,
                surname: form.surname,
                dob: form.dob,
                address: form.address,
            };
            if (form.password) payload.password = form.password;

            await api.updateProfile(payload);
            alert("Profilo aggiornato con successo!");
            loadProfile();
        } catch (e) {
            alert("Errore aggiornamento: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const containerStyle = {
        maxWidth: '800px',
        margin: '40px auto',
        padding: '20px',
        fontFamily: '"Inter", sans-serif',
    };

    const cardStyle = {
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        border: '1px solid #eef2f6'
    };

    const headerStyle = {
        background: 'linear-gradient(135deg, #3f51b5 0%, #2196f3 100%)',
        padding: '40px',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
    };

    const avatarStyle = {
        width: '80px',
        height: '80px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2.5rem',
        fontWeight: 'bold',
        color: 'white',
        border: '2px solid rgba(255,255,255,0.4)'
    };

    const badgeStyle = {
        backgroundColor: user.role === 'ADMIN' ? '#ff9800' : '#4caf50',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px'
    };

    const formSectionStyle = {
        padding: '40px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '25px'
    };

    const inputGroupStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    };

    const labelStyle = {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#555'
    };

    const inputStyle = {
        padding: '12px 15px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '1rem',
        outline: 'none',
        transition: 'border-color 0.2s',
        backgroundColor: '#f9fafb'
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>

                {/* Header */}
                <div style={headerStyle}>
                    <div style={avatarStyle}>
                        {form.name ? form.name[0].toUpperCase() : <User size={40} />}
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{form.name} {form.surname}</h1>
                        <div style={{ marginTop: '10px' }}>
                            <span style={badgeStyle}>
                                <Shield size={14} />
                                {user.role === 'ADMIN' ? 'MANAGER' : 'OPERATORE'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={formSectionStyle}>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Nome</label>
                        <input
                            type="text"
                            required
                            style={inputStyle}
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Cognome</label>
                        <input
                            type="text"
                            required
                            style={inputStyle}
                            value={form.surname}
                            onChange={(e) => setForm({ ...form, surname: e.target.value })}
                        />
                    </div>

                    <div style={{ ...inputGroupStyle, gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Email (Personale)</label>
                        <input
                            type="email"
                            disabled
                            style={{ ...inputStyle, backgroundColor: '#eaeff2', cursor: 'not-allowed', color: '#777' }}
                            value={form.email}
                        />
                        <small style={{ color: '#888' }}>L'email è utilizzata per il login e non può essere modificata.</small>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Data di Nascita</label>
                        <input
                            type="date"
                            style={inputStyle}
                            value={form.dob}
                            onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Indirizzo</label>
                        <input
                            type="text"
                            style={inputStyle}
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                    </div>

                    <div style={{ ...inputGroupStyle, gridColumn: '1 / -1', marginTop: '10px', padding: '20px', backgroundColor: '#fff8e1', borderRadius: '8px', border: '1px solid #ffe0b2' }}>
                        <label style={{ ...labelStyle, color: '#d84315', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={16} /> Modifica Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', backgroundColor: 'white' }}
                                placeholder="Inserisci nuova password..."
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#666'
                                }}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <small style={{ color: '#d84315' }}>Lascia vuoto se non vuoi cambiare la password.</small>
                    </div>

                    <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '15px',
                                backgroundColor: '#1a237e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                cursor: loading ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}
                        >
                            <Save size={20} />
                            {loading ? 'Salvataggio...' : 'Salva Modifiche Profilo'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
