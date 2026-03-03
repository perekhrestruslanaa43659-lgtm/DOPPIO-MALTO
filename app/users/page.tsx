
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
// import { useAuth } from '@/context/AuthContext'; // We might implement this later or use session
import { Trash2, User, UserPlus, Search, Eye, EyeOff, Shield, ShieldAlert, Clock, Key, CheckCircle, Edit2 } from 'lucide-react';
import Link from 'next/link';

interface UserData {
    id: number;
    email: string;
    name: string | null;
    surname: string | null;
    role: string;
    // password is not returned
}

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPassword, setShowPassword] = useState<Record<number, boolean>>({});
    const [editingUser, setEditingUser] = useState<any>(null); // For Edit Modal

    const [form, setForm] = useState({
        name: '',
        surname: '',
        email: '',
        password: '',
        role: 'USER'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        setLoading(true);
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm("Sei sicuro di voler eliminare questo utente?")) return;
        try {
            await api.deleteUser(id);
            loadUsers();
        } catch (e: any) {
            alert("Errore eliminazione: " + e.message);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const res = await api.createUser(form);
            if (res.emailSent) {
                alert("✅ Utente creato! Email inviata.");
            } else {
                alert("✅ Utente creato. (Email non inviata: controlla SMTP).");
            }
            setForm({ name: '', surname: '', email: '', password: '', role: 'USER' });
            loadUsers();
        } catch (e: any) {
            alert("Errore creazione: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleResetPassword(email: string) {
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
    }

    async function handleManualVerify(id: number) {
        if (!confirm("Sei sicuro di voler verificare manualmente questo utente?")) return;
        try {
            const res = await fetch(`/api/users/${id}/verify`, {
                method: 'POST'
            });
            if (res.ok) {
                alert("✅ Utente verificato con successo!");
                loadUsers();
            } else {
                const data = await res.json();
                alert("Errore verifica: " + (data.error || 'Errore sconosciuto'));
            }
        } catch (e) {
            alert("Errore di comunicazione.");
        }
    }

    async function handleUpdateUser(e: React.FormEvent) {
        e.preventDefault();
        if (!editingUser) return;
        try {
            await api.updateUser(editingUser); // Need to add this to api.ts likely, or use fetch
            alert("✅ Utente aggiornato con successo!");
            setEditingUser(null);
            loadUsers();
        } catch (e: any) {
            alert("Errore aggiornamento: " + e.message);
        }
    }

    const filteredUsers = users.filter(u =>
        (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    function getInitials(name: string | null, surname: string | null) {
        return ((name?.[0] || '') + (surname?.[0] || '')).toUpperCase() || '?';
    }

    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* ... Header ... */}
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Gestione Utenti</h1>

            {/* CREATE FORM */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-8 transition-colors">
                {/* ... Title ... */}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    {/* ... Input fields ... */}
                    {/* (Need to target the button to disable it) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome *</label>
                        <input required className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white outline-none transition-colors" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cognome</label>
                        <input className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white outline-none transition-colors" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                        <input required type="email" className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white outline-none transition-colors" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruolo</label>
                        <select className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white outline-none transition-colors" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="OWNER">OWNER</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password (Opzionale)</label>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white outline-none transition-colors placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="Auto-generata se vuoto"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                        />
                    </div>
                    <div className="lg:col-span-5 flex justify-end mt-4">
                        <button type="submit" disabled={isSubmitting} className="bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition font-medium flex items-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-200 dark:shadow-none">
                            <UserPlus size={18} /> {isSubmitting ? 'Creazione...' : 'Crea Utente'}
                        </button>
                    </div>
                </form>
            </div>

            {/* SEARCH */}
            <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                    type="text"
                    className="pl-10 block w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                    placeholder="Cerca utente per nome o email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* TABLE */}
            {loading ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">Caricamento...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-x-auto transition-colors">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider">Utente</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider">Dettagli Account</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider">Info Azienda</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-center">Ruolo</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {filteredUsers.map((u, i) => (
                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${colors[u.id % colors.length]} shadow-sm`}>
                                                {getInitials(u.name, u.surname)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{u.name} {u.surname}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">ID: {u.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm">
                                        <div className="font-medium text-gray-700 dark:text-gray-300">{u.email}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">Creato: {new Date(u.createdAt).toLocaleDateString()}</div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                        <div>{u.companyName || '-'}</div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{u.tenantKey}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${u.role === 'ADMIN' || u.role === 'OWNER' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300' : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => setEditingUser(u)}
                                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition mr-2"
                                            title="Modifica"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <Link href={`/admin/users/${u.id}/history`} className="inline-block mr-2">
                                            <button className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition" title="Storico Accessi">
                                                <Clock size={18} />
                                            </button>
                                        </Link>
                                        <button
                                            onClick={() => handleResetPassword(u.email)}
                                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition mr-2"
                                            title="Invia Email Reset Password"
                                        >
                                            <Key size={18} />
                                        </button>
                                        {!u.isVerified && (
                                            <button
                                                onClick={() => handleManualVerify(u.id)}
                                                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition mr-2"
                                                title="Verifica Manualmente"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                                            title="Elimina"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* EDIT MODAL */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-700 transition-colors">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Modifica Utente #{editingUser.id}</h2>
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nome</label>
                                    <input className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={editingUser.name || ''}
                                        onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cognome</label>
                                    <input className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={editingUser.surname || ''}
                                        onChange={e => setEditingUser({ ...editingUser, surname: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
                                <input className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={editingUser.email || ''}
                                    onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nuova Password (lascia vuoto per non cambiare)</label>
                                <input
                                    type="password"
                                    className="w-full p-2 border border-blue-200 dark:border-blue-900/50 rounded-lg bg-blue-50 dark:bg-blue-900/10 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-blue-300 dark:placeholder-blue-700"
                                    placeholder="Scrivi qui per resettare la password..."
                                    value={editingUser.password || ''}
                                    onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Ruolo</label>
                                <select className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={editingUser.role || 'USER'}
                                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                                    <option value="USER">USER</option>
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="OWNER">OWNER</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition font-medium">Annulla</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-bold shadow-sm">Salva Modifiche</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
