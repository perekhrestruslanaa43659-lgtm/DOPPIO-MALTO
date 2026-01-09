import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

import RegisterPage from './RegisterPage';

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    if (isRegistering) {
        return <RegisterPage onLoginClick={() => setIsRegistering(false)} />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        }}>
            <div className="panel" style={{ width: '400px', padding: '40px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', background: 'white', borderRadius: '10px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>Scheduling Login</h2>

                {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
                    {error}
                </div>}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email</label>
                        <input
                            type="text"
                            className="input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                            placeholder="admin@scheduling.com"
                        />
                    </div>
                    <div style={{ marginBottom: '30px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Password</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                            placeholder="default: admin"
                        />
                    </div>
                    <button className="btn" style={{ width: '100%', padding: '12px', fontSize: '1.1em', background: '#4a90e2' }}>
                        Accedi
                    </button>

                    <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                        <span style={{ color: '#666', fontSize: '0.9em' }}>Non hai un account? </span>
                        <button type="button" onClick={() => setIsRegistering(true)} style={{ background: 'none', border: 'none', color: '#4a90e2', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>
                            Registrati come Operatore
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
