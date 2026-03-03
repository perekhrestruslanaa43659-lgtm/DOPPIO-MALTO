'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useTheme } from 'next-themes';
import { Settings, Save, Server, ShieldCheck, Mail, Globe, Lock, Key, Link as LinkIcon, AlertCircle, Sun, Moon, Monitor } from 'lucide-react';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'appearance'>('general');
    const { theme, setTheme } = useTheme();

    // General Settings State
    const [form, setForm] = useState({
        provider: 'GMAIL',
        smtpHost: '',
        smtpPort: '',
        smtpUser: '',
        smtpPassword: '',
    });
    const [hasPassword, setHasPassword] = useState(false);

    // Integrations State
    const [integrations, setIntegrations] = useState<any[]>([]);
    const [editingIntegration, setEditingIntegration] = useState<any>(null); // Provider name if editing

    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            const [settings, ints] = await Promise.all([
                api.getSettings(),
                api.getIntegrations().catch(() => [])
            ]);

            setForm({
                provider: settings.smtpProvider || 'GMAIL',
                smtpHost: settings.smtpHost || '',
                smtpPort: settings.smtpPort || '',
                smtpUser: settings.smtpUser || '',
                smtpPassword: '',
            });
            setHasPassword(settings.hasPassword);
            setIntegrations(Array.isArray(ints) ? ints : []);

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
            setForm({ ...form, smtpPassword: '' });
        } catch (e: any) {
            setMessage({ type: 'error', text: 'Errore salvataggio: ' + e.message });
        } finally {
            setSaving(false);
        }
    }

    async function handleTest(e: React.MouseEvent) {
        e.preventDefault();
        setTesting(true);
        setMessage(null);
        try {
            if (!form.smtpUser || (!form.smtpPassword && !hasPassword)) {
                setMessage({ type: 'error', text: 'Inserisci Utente e Password prima di testare.' });
                setTesting(false);
                return;
            }

            if (!form.smtpPassword && hasPassword) {
                if (!confirm("Per testare la connessione devi reinserire la password (per sicurezza non viene salvata nel browser). Vuoi procedere comunque (fallirà se password vuota)?")) {
                    setTesting(false);
                    return;
                }
            }

            const res = await fetch('/api/settings/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: '✅ ' + data.message });
            } else {
                setMessage({ type: 'error', text: '❌ Errore SMTP: ' + data.error });
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: 'Errore di rete: ' + e.message });
        } finally {
            setTesting(false);
        }
    }

    const saveIntegration = async (provider: string, data: any) => {
        setSaving(true);
        try {
            // Filter out masked values so we don't overwrite with '***MASKED***'
            const payload = { ...data, provider };

            // Check for masking pattern - if it looks masked, do not send it (keep existing)
            if (payload.apiKey && (payload.apiKey.includes('***') || payload.apiKey.includes('...'))) {
                delete payload.apiKey;
            }
            if (payload.apiSecret && payload.apiSecret === '***MASKED***') {
                delete payload.apiSecret;
            }

            await api.saveIntegration(payload);
            setMessage({ type: 'success', text: `Integrazione ${provider} salvata!` });

            // Refresh list
            const ints = await api.getIntegrations();
            setIntegrations(Array.isArray(ints) ? ints : []);
            setEditingIntegration(null);
        } catch (e: any) {
            setMessage({ type: 'error', text: 'Errore salvataggio integrazione: ' + e.message });
        } finally {
            setSaving(false);
        }
    };

    const IntegrationCard = ({ provider, name, icon, description }: any) => {
        const int = integrations.find(i => i.provider === provider);
        const isActive = int?.status === 'ACTIVE';
        const isEditing = editingIntegration === provider;

        const [localData, setLocalData] = useState({
            apiKey: int?.apiKey || '',
            apiSecret: int?.apiSecret || '',
            apiUrl: int?.apiUrl || '',
            status: int?.status || 'INACTIVE'
        });

        if (isEditing) {
            return (
                <div className="bg-white border rounded-xl p-6 shadow-sm animate-in fade-in zoom-in-95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">{icon}</div>
                            <h3 className="font-bold text-gray-800">Configura {name}</h3>
                        </div>
                        <button onClick={() => setEditingIntegration(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setLocalData({ ...localData, status: 'ACTIVE' })}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${localData.status === 'ACTIVE' ? 'bg-green-100 text-green-700 ring-2 ring-green-500 ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Attivo
                                </button>
                                <button
                                    onClick={() => setLocalData({ ...localData, status: 'INACTIVE' })}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${localData.status === 'INACTIVE' ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-400 ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Disattivato
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Key / Token</label>
                            <div className="relative">
                                <Key size={14} className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="password"
                                    value={localData.apiKey}
                                    onChange={e => setLocalData({ ...localData, apiKey: e.target.value })}
                                    className="w-full pl-9 p-2 border rounded-md text-sm font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Incolla qui la tua API Key"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Secret (Opzionale)</label>
                            <div className="relative">
                                <Lock size={14} className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="password"
                                    value={localData.apiSecret}
                                    onChange={e => setLocalData({ ...localData, apiSecret: e.target.value })}
                                    className="w-full pl-9 p-2 border rounded-md text-sm font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Secret Key se richiesta"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API URL (Endpoint)</label>
                            <div className="relative">
                                <LinkIcon size={14} className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    value={localData.apiUrl}
                                    onChange={e => setLocalData({ ...localData, apiUrl: e.target.value })}
                                    className="w-full pl-9 p-2 border rounded-md text-sm font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="https://api.example.com/v1"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <button onClick={() => setEditingIntegration(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Annulla</button>
                            <button
                                onClick={() => saveIntegration(provider, localData)}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm font-medium flex items-center gap-2"
                            >
                                <Save size={16} /> Salva Configurazione
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return (
            <div className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full">
                <div>
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-gray-50 rounded-xl text-gray-700">{icon}</div>
                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {isActive ? 'Attivo' : 'Non Configurato'}
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{description}</p>
                </div>
                <button
                    onClick={() => setEditingIntegration(provider)}
                    className="w-full py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition flex items-center justify-center gap-2"
                >
                    <Settings size={16} /> Configura
                </button>
            </div>
        );
    };

    if (loading) return <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> Caricamento impostazioni...</div>;

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 mb-8 text-white shadow-xl">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <Settings className="w-8 h-8" />
                    Impostazioni Sistema
                </h1>
                <p className="opacity-80">Gestisci le configurazioni globali e le connessioni esterne.</p>

                <div className="flex gap-4 mt-8">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'general' ? 'bg-white/20 text-white backdrop-blur-sm' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                    >
                        <Mail size={16} /> Generale (SMTP)
                    </button>
                    <button
                        onClick={() => setActiveTab('integrations')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'integrations' ? 'bg-white/20 text-white backdrop-blur-sm' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                    >
                        <Globe size={16} /> Integrazioni
                    </button>
                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'appearance' ? 'bg-white/20 text-white backdrop-blur-sm' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                    >
                        <Sun size={16} /> Aspetto
                    </button>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 shadow-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {message.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                </div>
            )}

            {activeTab === 'appearance' ? (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-8">
                        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-700 pb-4">
                            <Sun className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Aspetto</h2>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Scegli il tema dell'interfaccia. La preferenza viene salvata automaticamente.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Light */}
                            <button
                                onClick={() => setTheme('light')}
                                className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${theme === 'light'
                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50'
                                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                                    }`}
                            >
                                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center shadow-sm">
                                    <Sun size={28} className="text-amber-500" />
                                </div>
                                <span className={`font-semibold text-sm ${theme === 'light' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-300'
                                    }`}>Chiaro</span>
                                {theme === 'light' && (
                                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">✓ Attivo</span>
                                )}
                            </button>

                            {/* Dark */}
                            <button
                                onClick={() => setTheme('dark')}
                                className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${theme === 'dark'
                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50'
                                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                                    }`}
                            >
                                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center shadow-sm">
                                    <Moon size={28} className="text-blue-400" />
                                </div>
                                <span className={`font-semibold text-sm ${theme === 'dark' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-300'
                                    }`}>Scuro</span>
                                {theme === 'dark' && (
                                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">✓ Attivo</span>
                                )}
                            </button>

                            {/* System */}
                            <button
                                onClick={() => setTheme('system')}
                                className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${theme === 'system'
                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50'
                                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                                    }`}
                            >
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-100 to-slate-800 flex items-center justify-center shadow-sm">
                                    <Monitor size={28} className="text-white" />
                                </div>
                                <span className={`font-semibold text-sm ${theme === 'system' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-300'
                                    }`}>Sistema</span>
                                {theme === 'system' && (
                                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">✓ Attivo</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'integrations' ? (
                <div className="animate-in fade-in slide-in-from-right-4">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Globe className="w-6 h-6 text-indigo-600" />
                        Integrazioni Esterne
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <IntegrationCard
                            provider="LIGHTSPEED"
                            name="Lightspeed (K-Series)"
                            icon={<div className="font-bold text-xl">L</div>}
                            description="Collega il tuo sistema di cassa per importare automaticamente i dati di vendita."
                        />
                        <IntegrationCard
                            provider="PLATEFORM"
                            name="Plateform"
                            icon={<div className="font-bold text-xl">P</div>}
                            description="Sincronizza prenotazioni e dati clienti."
                        />
                        <IntegrationCard
                            provider="OTHER"
                            name="Custom Webhook"
                            icon={<Globe size={24} />}
                            description="Configura endpoint generici per altri servizi."
                        />
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-left-4">
                    <div className="flex items-center justify-between mb-6 border-b pb-4">
                        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            Configurazione Email (SMTP)
                        </h2>
                        {hasPassword && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium border border-green-100">
                                <ShieldCheck size={14} />
                                Configurata
                            </span>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Provider Selection Cards */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Seleziona Provider</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, provider: 'GMAIL' })}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 py-6 ${form.provider === 'GMAIL' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                >
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-2xl font-bold bg-gradient-to-br from-red-500 to-yellow-500 bg-clip-text text-transparent">G</div>
                                    <span className="font-semibold">Gmail</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, provider: 'OUTLOOK' })}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 py-6 ${form.provider === 'OUTLOOK' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                >
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-2xl font-bold text-blue-600">O</div>
                                    <span className="font-semibold">Outlook</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, provider: 'CUSTOM' })}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 py-6 ${form.provider === 'CUSTOM' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}
                                >
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                                        <Server size={24} />
                                    </div>
                                    <span className="font-semibold">Altro / Custom</span>
                                </button>
                            </div>
                        </div>

                        {/* Credentials Area */}
                        <div className="space-y-6">
                            {/* Quick Hints */}
                            {form.provider === 'GMAIL' && (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex gap-2">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <div>
                                        Per Gmail devi usare una <strong>App Password</strong>, non la tua password abituale.
                                        <a href="https://myaccount.google.com/apppasswords" target="_blank" className="underline ml-1 font-medium hover:text-blue-900">Generala qui</a>.
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail size={16} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="email"
                                            className="pl-10 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors outline-none"
                                            placeholder="es. nome@azienda.com"
                                            value={form.smtpUser}
                                            onChange={e => setForm({ ...form, smtpUser: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Key size={16} className="text-gray-400" />
                                        </div>
                                        <input
                                            type="password"
                                            className="pl-10 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors outline-none"
                                            placeholder={hasPassword ? "••••••••••••••" : "Inserisci password"}
                                            value={form.smtpPassword}
                                            onChange={e => setForm({ ...form, smtpPassword: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Custom Only Fields */}
                            {form.provider === 'CUSTOM' && (
                                <div className="pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-sm font-medium text-gray-900 mb-3">Parametri Server</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Host SMTP</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Server size={16} className="text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="pl-10 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    placeholder="es. smtp.provider.com"
                                                    value={form.smtpHost}
                                                    onChange={e => setForm({ ...form, smtpHost: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                                            <input
                                                type="number"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="es. 465, 587"
                                                value={form.smtpPort}
                                                onChange={e => setForm({ ...form, smtpPort: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-6 border-t border-gray-100 gap-3">
                            <button
                                type="button"
                                onClick={handleTest}
                                disabled={testing || saving}
                                className="bg-white text-gray-700 border border-gray-300 px-6 py-2.5 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2 shadow-sm disabled:opacity-70"
                            >
                                {testing ? 'Test in corso...' : (
                                    <>
                                        <ShieldCheck size={18} /> Test Connessione
                                    </>
                                )}
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2 shadow-sm disabled:opacity-70"
                            >
                                {saving ? 'Salvataggio...' : (
                                    <>
                                        <Save size={18} /> Salva Configurazione
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
