'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { User, Lock, Save, ShieldCheck } from 'lucide-react';

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Password Form
    const [passForm, setPassForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const data = await api.getProfile();
            setProfile(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (passForm.newPassword !== passForm.confirmPassword) {
            setMessage({ type: 'error', text: 'Le nuove password non coincidono.' });
            return;
        }

        setSaving(true);
        try {
            await api.changePassword(passForm.currentPassword, passForm.newPassword);
            setMessage({ type: 'success', text: 'Password aggiornata con successo! Effettua nuovamente il login se necessario.' });
            setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || 'Errore aggiornamento password' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Caricamento profilo...</div>;

    if (!profile) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-4">Errore nel caricamento del profilo o sessione scaduta.</p>
                <a href="/login" className="text-indigo-600 hover:underline">Vai al Login</a>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 mb-8 text-white shadow-xl">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <User className="w-8 h-8" />
                    Il Mio Profilo
                </h1>
                <p className="opacity-90">Gestisci le tue informazioni personali e la sicurezza del tuo account.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* User Info Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-4xl font-bold mb-4">
                            {profile?.name?.[0]}{profile?.surname?.[0]}
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">{profile?.name} {profile?.surname}</h2>
                        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full mt-2 uppercase text-xs font-bold">
                            {profile?.role}
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Email</label>
                            <div className="text-gray-700 font-medium break-all">{profile?.email}</div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">Azienda/Tenant</label>
                            <div className="text-gray-700 font-medium">{profile?.companyName || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                {/* Change Password Form */}
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                        <Lock className="w-5 h-5 text-indigo-600" />
                        Cambio Password
                    </h3>

                    {message && (
                        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {message.type === 'success' ? <ShieldCheck size={20} /> : <ShieldCheck size={20} />}
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password Attuale</label>
                            <input
                                type="password"
                                required
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                value={passForm.currentPassword}
                                onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nuova Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    value={passForm.newPassword}
                                    onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Conferma Nuova Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    value={passForm.confirmPassword}
                                    onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2 shadow-sm disabled:opacity-70"
                            >
                                {saving ? 'Aggiornamento...' : (
                                    <>
                                        <Save size={18} /> Aggiorna Password
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
