'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        provider: 'CUSTOM',
        smtpHost: '',
        smtpPort: '',
        smtpUser: '',
        smtpPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('Le password non corrispondono');
            return;
        }

        if (formData.password.length < 6) {
            setError('La password deve essere di almeno 6 caratteri');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    provider: (formData as any).provider,
                    smtpHost: (formData as any).smtpHost,
                    smtpPort: (formData as any).smtpPort,
                    smtpUser: (formData as any).smtpUser,
                    smtpPassword: (formData as any).smtpPassword
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Registrazione fallita');
                setLoading(false);
                return;
            }

            // Redirect to login
            router.push('/login');
        } catch (err) {
            setError('Errore di connessione');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center">
                    Registrazione
                </h1>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="name" className="block text-sm font-medium mb-2">
                            Nome
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                            Conferma Password
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div className="border-t pt-4 mt-6 mb-6">
                        <h3 className="text-lg font-semibold mb-4 text-gray-700">Configurazione Email (Opzionale)</h3>
                        <p className="text-sm text-gray-500 mb-4">Inserisci i dati SMTP per inviare automaticamente le password ai dipendenti.</p>

                        {/* Provider Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Provider Email</label>
                            <select
                                name="provider"
                                value={(formData as any).provider || 'CUSTOM'}
                                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md"
                            >
                                <option value="GMAIL">Gmail</option>
                                <option value="OUTLOOK">Outlook / Hotmail</option>
                                <option value="YAHOO">Yahoo Mail</option>
                                <option value="ICLOUD">iCloud</option>
                                <option value="ARUBA">Aruba (PEC)</option>
                                <option value="CUSTOM">Personalizzato</option>
                            </select>
                            {(formData as any).provider === 'GMAIL' && (
                                <p className="text-xs text-gray-500 mt-1">
                                    Richiede App Password da <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-blue-600 underline">myaccount.google.com/apppasswords</a>
                                </p>
                            )}
                        </div>

                        {(formData as any).provider === 'CUSTOM' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-1">SMTP Host</label>
                                    <input type="text" name="smtpHost" placeholder="es. smtp.gmail.com" value={(formData as any).smtpHost || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-1">Porta</label>
                                    <input type="number" name="smtpPort" placeholder="es. 587" value={(formData as any).smtpPort || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
                                </div>
                            </div>
                        )}
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Email Mittente / Utente SMTP</label>
                            <input type="text" name="smtpUser" placeholder="tuamail@gmail.com" value={(formData as any).smtpUser || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Password SMTP</label>
                            <input type="password" name="smtpPassword" placeholder="App Password" value={(formData as any).smtpPassword || ''} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Registrazione in corso...' : 'Registrati'}
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-600">
                    Hai già un account?{' '}
                    <a href="/login" className="text-blue-600 hover:underline">
                        Accedi
                    </a>
                </p>
            </div>
        </div>
    );
}
