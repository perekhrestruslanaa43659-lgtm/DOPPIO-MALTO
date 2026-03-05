'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, CheckCircle, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        nome: '',
        cognome: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successEmail, setSuccessEmail] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

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
        if (!formData.nome || !formData.cognome || !formData.email || !formData.password || !formData.confirmPassword) {
            setError('Tutti i campi sono obbligatori');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Inserisci un indirizzo email valido');
            return;
        }

        // Password matching validation
        if (formData.password !== formData.confirmPassword) {
            setError('Le password non coincidono');
            return;
        }

        if (formData.password.length < 8) {
            setError('La password deve essere di almeno 8 caratteri');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${formData.nome} ${formData.cognome}`,
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Registrazione fallita');
                setLoading(false);
                return;
            }

            // Show success message with email verification instructions
            setSuccessEmail(formData.email);
            setSuccessMessage(data.message || 'Registrazione completata!');
            setLoading(false);
        } catch (err) {
            setError('Errore di connessione');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                {successEmail ? (
                    // Success Message
                    <div className="text-center space-y-6">
                        <div className="flex justify-center">
                            {successMessage.includes('email') || successMessage.includes('Email') || successMessage.includes('verifica') ? (
                                // Email verification required
                                <div className="bg-blue-100 rounded-full p-4">
                                    <Mail className="text-blue-600" size={40} />
                                </div>
                            ) : (
                                // Direct access
                                <div className="bg-green-100 rounded-full p-4">
                                    <CheckCircle className="text-green-600" size={40} />
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                {successMessage.includes('email') || successMessage.includes('Email') ? 'Verifica la tua Email' : 'Registrazione Completata!'}
                            </h2>
                            <p className="text-gray-600">{successMessage}</p>
                            {successMessage.includes('email') && (
                                <p className="text-lg font-semibold text-indigo-600 mt-2">{successEmail}</p>
                            )}
                        </div>

                        {successMessage.includes('email') ? (
                            // Email verification steps
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2">
                                <p className="text-sm text-gray-700">
                                    <strong>✓ Passaggi successivi:</strong>
                                </p>
                                <ol className="text-sm text-gray-600 space-y-1 ml-4">
                                    <li>1. Controlla la tua email (inclusa la cartella spam)</li>
                                    <li>2. Clicca sul link "Verifica Email"</li>
                                    <li>3. Il tuo account sarà attivato immediatamente</li>
                                </ol>
                                <p className="text-xs text-gray-500 mt-3">Il link di verifica scadrà tra 24 ore</p>
                            </div>
                        ) : (
                            // SMTP setup reminder
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left space-y-2">
                                <p className="text-sm text-gray-700">
                                    <strong>✓ Configurazione Email:</strong>
                                </p>
                                <p className="text-sm text-gray-600">
                                    Per inviare email al tuo team (turni, notifiche, ecc.), configura le impostazioni SMTP nella sezione "Impostazioni".
                                </p>
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                            >
                                Torna al Login
                                <ArrowRight size={18} />
                            </button>
                        </div>

                        {successMessage.includes('email') && (
                            <div className="pt-4 border-t border-gray-200">
                                <p className="text-xs text-gray-500">
                                    Non ricevi l'email?{' '}
                                    <button
                                        onClick={() => setSuccessEmail('')}
                                        className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                                    >
                                        Torna alla registrazione
                                    </button>
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    // Registration Form
                    <>
                        <h1 className="text-3xl font-bold mb-2 text-center text-gray-800">
                            Registrazione
                        </h1>
                        <p className="text-center text-gray-600 mb-6 text-sm">
                            Crea il tuo account ScheduFlow
                        </p>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                                <span className="text-xl">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="nome" className="block text-sm font-semibold mb-2 text-gray-700">
                                        Nome
                                    </label>
                                    <input
                                        type="text"
                                        id="nome"
                                        name="nome"
                                        value={formData.nome}
                                        onChange={handleChange}
                                        placeholder="Mario"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="cognome" className="block text-sm font-semibold mb-2 text-gray-700">
                                        Cognome
                                    </label>
                                    <input
                                        type="text"
                                        id="cognome"
                                        name="cognome"
                                        value={formData.cognome}
                                        onChange={handleChange}
                                        placeholder="Rossi"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold mb-2 text-gray-700">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="mario.rossi@esempio.it"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold mb-2 text-gray-700">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Min. 8 caratteri"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-semibold mb-2 text-gray-700">
                                    Conferma Password
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Ripeti la password"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Registrazione in corso...
                                    </span>
                                ) : (
                                    'Registrati'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <p className="text-center text-sm text-gray-600">
                                Hai già un account?{' '}
                                <a href="/login" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition">
                                    Accedi
                                </a>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
