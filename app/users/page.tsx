
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
// import { useAuth } from '@/context/AuthContext'; // We might implement this later or use session
import { Trash2, User, UserPlus, Search, Eye, EyeOff, Shield, ShieldAlert } from 'lucide-react';

interface UserData {
    id: number;
    email: string;
    name: string | null;
    surname: string | null;
    role: string;
    // password is not returned
}

export default function UsersPage() {
    // const { user } = useAuth(); // Assume logic for admin check is handled or we redirect if api fails
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPassword, setShowPassword] = useState<Record<number, boolean>>({}); // For newly created user? Or just remove this feature as backend doesn't return password usually.
    // Legacy code showed password if available? No, legacy API returns Users list. Does it return password? 
    // Legacy `api.js` `getUsers` returns full object? 
    // My new `api/users` route explicitly sorts out password. So we can't show password. 
    // Legacy `UsersPage.jsx` renders `u.password`. This is bad security practice in legacy.
    // I will REMOVE displaying existing passwords.

    const [form, setForm] = useState({
        name: '',
        surname: '',
        email: '',
        password: '', // Kept for type safety but unused
        role: 'USER'
    });

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        setLoading(true);
        try {
            const data = await api.getUsers();
            setUsers(data as UserData[]);
        } catch (e: any) {
            console.error(e);
            // alert('Errore caricamento utenti: ' + e.message);
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
        try {
            const res = await api.createUser(form);
            if (res.emailSent) {
                alert("✅ Utente creato! Email con password inviata con successo.");
            } else {
                alert("✅ Utente creato, ma ERRORE invio email: " + (res.emailError || 'Sconosciuto') + "\n\nLa password è stata generata ma l'utente non l'ha ricevuta. Controlla configurazione SMTP.");
            }
            setForm({ name: '', surname: '', email: '', password: '', role: 'USER' });
            loadUsers();
        } catch (e: any) {
            alert("Errore creazione: " + e.message);
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
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 mb-8 text-white shadow-xl">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <User className="w-8 h-8" />
                    Gestione Utenti
                </h1>
                <p className="opacity-90">Gestisci gli utenti del sistema, controlla i ruoli e aggiungi nuovi membri.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-600" />
                    Aggiungi Nuovo Utente
                </h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                        <input required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                        <input className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input required type="email" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                        <select className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                    </div>
                    <div className="lg:col-span-5 flex justify-end mt-4">
                        <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2">
                            <UserPlus size={18} /> Crea Utente
                        </button>
                    </div>
                </form>
            </div>

            <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="pl-10 block w-full p-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                    placeholder="Cerca utente..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="text-center py-10 text-gray-500">Caricamento...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Utente</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Ruolo</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((u, i) => (
                                <tr key={u.id} className="hover:bg-gray-50 transition">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${colors[u.id % colors.length]}`}>
                                                {getInitials(u.name, u.surname)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{u.name} {u.surname}</div>
                                                <div className="text-xs text-gray-500">ID: {u.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-600">{u.email}</td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                            {u.role === 'ADMIN' ? <ShieldAlert size={12} /> : <Shield size={12} />}
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="Elimina"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">
                                        Nessun utente trovato.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
