'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Settings, Save, Server, ShieldCheck, Mail } from 'lucide-react';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        provider: 'CUSTOM',
        smtpHost: '',
        smtpPort: '',
        smtpUser: '',
        smtpPassword: '', // Will be empty on load if exists, waiting for new input
    });
    const [hasPassword, setHasPassword] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            const data = await api.getSettings();
            setForm({
                provider: 'CUSTOM', // Default to custom since we don't store provider
                smtpHost: data.smtpHost || '',
                smtpPort: data.smtpPort || '',
                smtpUser: data.smtpUser || '',
                smtpPassword: '', // Don't show existing password
            });
            setHasPassword(data.hasPassword);
        } catch (e: any) {
            console.error(e);
            setMessage({ type: 'error', text: 'Errore caricamento impostazioni.' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await api.updateSettings(form);
            setMessage({ type: 'success', text: 'Impostazioni salvate con successo!' });
            setHasPassword(true);
            setForm({ ...form, smtpPassword: '' }); // Clear password field after save
        } catch (e: any) {
            setMessage({ type: 'error', text: 'Errore salvataggio: ' + e.message });
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Caricamento impostazioni...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-2xl p-8 mb-8 text-white shadow-xl">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <Settings className="w-8 h-8" />
                    Impostazioni Sistema
                </h1>
                <p className="opacity-90">Configura le preferenze globali del tuo account e le integrazioni.</p>
            </div>

            {message && (
                <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? <ShieldCheck size={20} /> : <ShieldCheck size={20} />}
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                    <Mail className="w-5 h-5 text-indigo-600" />
                    Configurazione Email (SMTP)
                </h2>
                <p className="text-gray-500 mb-6 text-sm">
                    Questi dati servono per inviare email automatiche ai tuoi dipendenti (es. credenziali di accesso).
                    <br />
                    Se usi Gmail, devi generare una <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-indigo-600 underline">App Password</a>.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Provider Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Provider Email</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            value={form.provider}
                            onChange={e => setForm({ ...form, provider: e.target.value })}
                        >
                            <option value="GMAIL">Gmail</option>
                            <option value="OUTLOOK">Outlook / Hotmail</option>
                            <option value="YAHOO">Yahoo Mail</option>
                            <option value="ICLOUD">iCloud</option>
                            <option value="ARUBA">Aruba (PEC)</option>
                            <option value="CUSTOM">Personalizzato</option>
                        </select>
                        {form.provider === 'GMAIL' && (
                            <p className="text-xs text-gray-500 mt-1">
                                Richiede App Password da <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-indigo-600 underline">myaccount.google.com/apppasswords</a>
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {form.provider === 'CUSTOM' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Server size={16} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            placeholder="es. smtp.gmail.com"
                                            value={form.smtpHost}
                                            onChange={e => setForm({ ...form, smtpHost: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="es. 587 o 465"
                                        value={form.smtpPort}
                                        onChange={e => setForm({ ...form, smtpPort: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Mittente (Utente SMTP)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail size={16} className="text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="tua@email.com"
                                    value={form.smtpUser}
                                    onChange={e => setForm({ ...form, smtpUser: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password SMTP (App Password)
                                {hasPassword && <span className="ml-2 text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full border border-green-100">Configurata ✅</span>}
                            </label>
                            <input
                                type="password"
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                placeholder={hasPassword ? "Lascia vuoto per non cambiare" : "Inserisci la password"}
                                value={form.smtpPassword}
                                onChange={e => setForm({ ...form, smtpPassword: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2 shadow-sm disabled:opacity-70"
                        >
                            {saving ? 'Salvataggio...' : (
                                <>
                                    <Save size={18} /> Salva Impostazioni
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
