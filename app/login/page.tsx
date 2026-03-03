'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Login fallito');
                setLoading(false);
                return;
            }

            // Redirect to dashboard using window.location for hard refresh
            // This ensures the cookie is available before the next page loads
            window.location.href = '/';
        } catch (err) {
            setError('Errore di connessione');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 transition-colors">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md w-full max-w-md border border-gray-200 dark:border-slate-700">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
                    Scheduling App - Login
                </h1>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
                        {error}
                        {error.includes('non verificato') && (
                            <div className="mt-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!email) { alert('Inserisci la tua email nel campo sopra.'); return; }
                                        try {
                                            const res = await fetch('/api/auth/resend-verification', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ email })
                                            });
                                            const d = await res.json();
                                            if (res.ok) alert('Email di verifica inviata! Controlla la tua casella di posta.');
                                            else alert('Errore: ' + d.error);
                                        } catch (e) {
                                            alert('Errore di connessione.');
                                        }
                                    }}
                                    className="text-sm font-bold underline hover:text-red-900 dark:hover:text-red-300"
                                >
                                    Invia nuova email di verifica
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white bg-white dark:bg-slate-700"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white bg-white dark:bg-slate-700"
                            required
                        />
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <div className="text-sm">
                            <a href="/auth/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                                Password dimenticata?
                            </a>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/30 dark:shadow-blue-900/40"
                    >
                        {loading ? 'Accesso in corso...' : 'Accedi'}
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    Non hai un account?{' '}
                    <a href="/register" className="text-blue-600 hover:underline dark:text-blue-400">
                        Registrati
                    </a>
                </p>
            </div>
        </div>
    );
}
