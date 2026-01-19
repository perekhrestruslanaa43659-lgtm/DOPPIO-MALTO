import React, { useState } from 'react';
import api from '../util/api';
import { User, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export default function RegisterPage({ onLoginClick }) {
    const [form, setForm] = useState({
        name: '',
        surname: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirmPassword) {
            setError("Le password non coincidono");
            return;
        }
        if (form.password.length < 6) {
            setError("La password deve essere di almeno 6 caratteri");
            return;
        }

        setLoading(true);
        try {
            // Register with role 'USER' (default in backend usually, but let's send it)
            // api.register signature: { name, email, password, role, surname... }
            // Wait, does backend register support surname? 
            // Previous auth.js only took name, email, password, role. 
            // Current auth.js probably has User create.
            // I should update backend register to accept surname/dob/address if needed, or user updates profile later.
            // Let's send basic info first.
            await api.register({
                name: form.name,
                surname: form.surname,
                email: form.email,
                password: form.password,
                role: 'USER'
            });
            setSuccess(true);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
            }}>
                <div className="panel" style={{ width: '400px', padding: '40px', textAlign: 'center', background: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                    <div style={{ color: '#4caf50', marginBottom: '20px' }}>
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <h2>Registrazione Completata!</h2>
                    <p style={{ color: '#666', marginBottom: '30px' }}>Il tuo account è stato creato. Ora puoi accedere.</p>
                    <button className="btn" style={{ width: '100%', padding: '12px', background: '#4a90e2' }} onClick={onLoginClick}>
                        Vai al Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        }}>
            <div className="panel" style={{ width: '400px', padding: '40px', background: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>Nuovo Account</h2>
                <p style={{ textAlign: 'center', marginBottom: '30px', color: '#666', fontSize: '0.9em' }}>
                    Unisciti al team. Compila i dati qui sotto.
                </p>

                {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '4px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertCircle size={18} /> {error}
                </div>}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '0.9em' }}>Nome</label>
                            <input
                                type="text"
                                className="input"
                                required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '0.9em' }}>Cognome</label>
                            <input
                                type="text"
                                className="input"
                                required
                                value={form.surname}
                                onChange={e => setForm({ ...form, surname: e.target.value })}
                                style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '0.9em' }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                            <input
                                type="email"
                                className="input"
                                required
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                style={{ width: '100%', padding: '10px 10px 10px 35px', boxSizing: 'border-box' }}
                                placeholder="tuo@email.com"
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '0.9em' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                            <input
                                type="password"
                                className="input"
                                required
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                style={{ width: '100%', padding: '10px 10px 10px 35px', boxSizing: 'border-box' }}
                                placeholder="Min. 6 caratteri"
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '30px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '0.9em' }}>Conferma Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                            <input
                                type="password"
                                className="input"
                                required
                                value={form.confirmPassword}
                                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                                style={{ width: '100%', padding: '10px 10px 10px 35px', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <button className="btn" disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '1.1em', background: '#3f51b5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        {loading ? 'Registrazione...' : 'Crea Account'} <ArrowRight size={20} />
                    </button>

                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <span style={{ color: '#666', fontSize: '0.9em' }}>Hai già un account? </span>
                        <button type="button" onClick={onLoginClick} style={{ background: 'none', border: 'none', color: '#3f51b5', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>
                            Accedi qui
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
