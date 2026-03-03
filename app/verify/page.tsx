'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function VerifyContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Token mancante.');
            return;
        }

        verifyToken(token);
    }, [token]);

    const verifyToken = async (token: string) => {
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await res.json();

            if (res.ok) {
                setStatus('success');
            } else {
                setStatus('error');
                setMessage(data.error || 'Errore durante la verifica.');
            }
        } catch (error) {
            setStatus('error');
            setMessage('Errore di connessione.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                {status === 'loading' && (
                    <div className="flex flex-col items-center">
                        <Loader2 size={48} className="text-indigo-600 animate-spin mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900">Verifica in corso...</h2>
                        <p className="text-gray-500 mt-2">Stiamo attivando il tuo account.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <CheckCircle size={64} className="text-green-500 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900">Account Verificato!</h2>
                        <p className="text-gray-500 mt-2 mb-6">Grazie per aver confermato la tua email. Ora puoi accedere.</p>
                        <Link href="/login" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30">
                            Vai al Login
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <XCircle size={64} className="text-red-500 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900">Verifica Fallita</h2>
                        <p className="text-gray-500 mt-2 mb-6">{message}</p>
                        <Link href="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
                            Torna al Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VerifyContent />
        </Suspense>
    );
}
