'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react';

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Le password non coincidono' });
            return;
        }

        if (password.length < 6) {
            setMessage({ type: 'error', text: 'La password deve essere almeno di 6 caratteri' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setTimeout(() => router.push('/login'), 2000);
            } else {
                setMessage({ type: 'error', text: data.error || 'Errore durante il reset' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Errore di connessione' });
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center">
                <h2 className="text-xl font-bold text-red-600">Token Mancante</h2>
                <p className="mt-2 text-gray-600">Il link di reset non è valido.</p>
                <div className="mt-4">
                    <Link href="/auth/forgot-password" className="text-indigo-600 hover:underline">Richiedi un nuovo link</Link>
                </div>
            </div>
        );
    }

    if (message?.type === 'success') {
        return (
            <div className="text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h2 className="mt-2 text-2xl font-bold text-gray-900">Password Aggiornata!</h2>
                <p className="mt-2 text-gray-600">La tua password è stata modificata con successo.</p>
                <p className="mt-4 text-sm text-gray-500">Verrai reindirizzato al login in pochi secondi...</p>
                <div className="mt-6">
                    <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                        Vai subito al Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="text-center">
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Imposta Nuova Password</h2>
                <p className="mt-2 text-sm text-gray-600">
                    Scegli una password sicura per il tuo account.
                </p>
            </div>

            {message && (
                <div className={`mt-4 p-4 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div className="rounded-md shadow-sm -space-y-px">
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Nuova Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Nuova Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Conferma Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type="password"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Conferma Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {loading ? 'Salvataggio...' : 'Aggiorna Password'}
                    </button>
                </div>
            </form>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <Suspense fallback={<div>Caricamento...</div>}>
                    <ResetPasswordContent />
                </Suspense>
            </div>
        </div>
    );
}
