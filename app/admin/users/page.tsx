'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Users, Shield, ArrowLeft, Clock, Key } from 'lucide-react';
import Link from 'next/link';

interface UserData {
    id: number;
    name: string | null;
    email: string;
    role: string;
    tenantKey: string;
    lastLogin: string | null;
    createdAt: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            // We need an endpoint to get users.
            // If it doesn't exist, we might need to add it or use a raw fetch if api client doesn't have it.
            // For now, assuming we might need to create it.
            // Let's try fetching from a new endpoint we'll create: /api/admin/users
            const res = await fetch('/api/admin/users');
            if (!res.ok) throw new Error('Errore caricamento utenti');
            const data = await res.json();
            setUsers(data.users);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (email: string) => {
        if (!confirm(`Inviare email di reset password a ${email}?`)) return;
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                alert('Email di reset inviata con successo!');
            } else {
                alert('Errore invio email.');
            }
        } catch (e) {
            console.error(e);
            alert('Errore di comunicazione.');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-gray-50">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Users className="text-indigo-600" size={32} />
                        Gestione Utenti
                    </h1>
                    <p className="text-gray-500 mt-2">Visualizza e gestisci gli utenti del sistema.</p>
                </div>
                <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
                    <ArrowLeft size={20} /> Torna alla Dashboard
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
            ) : (
                <div className="space-y-6">
                    {/* Stats Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                            <Users size={32} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Totale Utenti</p>
                            <p className="text-3xl font-bold text-gray-900">{users.length}</p>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="p-4 border-b">Utente</th>
                                    <th className="p-4 border-b">Ruolo</th>
                                    <th className="p-4 border-b">Ultimo Accesso</th>
                                    <th className="p-4 border-b">Data Registrazione</th>
                                    <th className="p-4 border-b">Tenant</th>
                                    <th className="p-4 border-b">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50 transition">
                                        <td className="p-4">
                                            <div>
                                                <p className="font-bold text-gray-900">{u.name || 'N/A'}</p>
                                                <p className="text-sm text-gray-500">{u.email}</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {u.lastLogin ? new Date(u.lastLogin).toLocaleString('it-IT') : 'Mai'}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {new Date(u.createdAt).toLocaleDateString('it-IT')}
                                        </td>
                                        <td className="p-4 text-xs font-mono text-gray-400">
                                            {u.tenantKey}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Link href={`/admin/users/${u.id}/history`}>
                                                    <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center gap-1">
                                                        <Clock size={16} /> Storico
                                                    </button>
                                                </Link>
                                                <button
                                                    onClick={() => handleResetPassword(u.email)}
                                                    className="text-amber-600 hover:text-amber-900 text-sm font-medium flex items-center gap-1"
                                                >
                                                    <Key size={16} /> Reset
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
