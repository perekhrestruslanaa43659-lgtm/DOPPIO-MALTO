'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
    Shield, ToggleLeft, ToggleRight, Plus, Trash2, ChevronDown, ChevronUp,
    Settings, Info, AlertTriangle, CheckCircle2, Lock, Zap
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Rule {
    id: number;
    code: string;
    name: string;
    description: string;
    enabled: boolean;
    params: string;
    isBuiltin: boolean;
}

const RULE_ICONS: Record<string, string> = {
    MAX_HOURS: '⏱️',
    ONE_SHIFT_PER_DAY: '📅',
    REST_HOURS: '😴',
    MANAGER_SAME_DAY: '👔',
    BLACKLIST_RESPECT: '🚫',
    FIXED_SHIFTS: '📌',
    PERMISSIONS: '✅',
    SENIOR_PIT_RATIO: '⭐',
    WEEKEND_EQUITY: '⚖️',
};

// ─── Param Editor ─────────────────────────────────────────────────────────────
function ParamEditor({ rule, onSave }: { rule: Rule; onSave: (params: string) => void }) {
    const [raw, setRaw] = useState(rule.params);
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(false);

    // Parse known params into structured UI
    let parsed: Record<string, any> = {};
    try { parsed = JSON.parse(rule.params); } catch { }

    const handleRawChange = (v: string) => {
        setRaw(v);
        setDirty(true);
        try { JSON.parse(v); setError(''); } catch { setError('JSON non valido'); }
    };

    const handleSave = () => {
        if (error) return;
        onSave(raw);
        setDirty(false);
    };

    const isEmpty = Object.keys(parsed).length === 0;

    if (isEmpty) {
        return (
            <p className="text-xs text-gray-400 italic mt-1">
                Nessun parametro configurabile per questa regola.
            </p>
        );
    }

    return (
        <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parametri</p>

            {/* Structured param inputs for known rule types */}
            {rule.code === 'REST_HOURS' && (
                <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 min-w-[160px]">Ore di riposo minimo</label>
                    <input
                        type="number" min={1} max={24}
                        value={parsed.hours ?? 11}
                        onChange={e => {
                            const v = JSON.stringify({ ...parsed, hours: Number(e.target.value) });
                            setRaw(v); setDirty(true); setError('');
                        }}
                        className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-mono"
                    />
                    <span className="text-sm text-gray-400">ore</span>
                </div>
            )}

            {rule.code === 'MANAGER_SAME_DAY' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 min-w-[220px]">Max manager stesso giorno</label>
                        <input
                            type="number" min={1} max={5}
                            value={parsed.max ?? 1}
                            onChange={e => {
                                const v = JSON.stringify({ ...parsed, max: Number(e.target.value) });
                                setRaw(v); setDirty(true); setError('');
                            }}
                            className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-mono"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 min-w-[220px]">Eccezione alto traffico (coperti ≥)</label>
                        <input
                            type="number" min={0} step={10}
                            value={parsed.coversThreshold ?? 180}
                            onChange={e => {
                                const v = JSON.stringify({ ...parsed, coversThreshold: Number(e.target.value) });
                                setRaw(v); setDirty(true); setError('');
                            }}
                            className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-mono"
                        />
                        <span className="text-sm text-gray-400">coperti</span>
                    </div>
                </div>
            )}

            {rule.code === 'SENIOR_PIT_RATIO' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 min-w-[220px]">% minima Senior (turni intensi)</label>
                        <input
                            type="number" min={0} max={100} step={5}
                            value={Math.round((parsed.minRatio ?? 0.4) * 100)}
                            onChange={e => {
                                const v = JSON.stringify({ ...parsed, minRatio: Number(e.target.value) / 100 });
                                setRaw(v); setDirty(true); setError('');
                            }}
                            className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-mono"
                        />
                        <span className="text-sm text-gray-400">%</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 min-w-[220px]">Soglia PIT "alta intensità"</label>
                        <input
                            type="number" min={1} max={5} step={0.5}
                            value={parsed.pitThreshold ?? 3.5}
                            onChange={e => {
                                const v = JSON.stringify({ ...parsed, pitThreshold: Number(e.target.value) });
                                setRaw(v); setDirty(true); setError('');
                            }}
                            className="w-20 border rounded-lg px-2 py-1 text-sm text-center font-mono"
                        />
                        <span className="text-sm text-gray-400">PIT</span>
                    </div>
                </div>
            )}

            {/* Raw JSON fallback for custom rules or unknown params */}
            {!['REST_HOURS', 'MANAGER_SAME_DAY', 'SENIOR_PIT_RATIO'].includes(rule.code) && (
                <textarea
                    value={raw}
                    onChange={e => handleRawChange(e.target.value)}
                    rows={3}
                    className="w-full font-mono text-xs border rounded-lg p-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder='{}'
                />
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            {dirty && (
                <button
                    onClick={handleSave}
                    disabled={!!error}
                    className="mt-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition"
                >
                    Salva parametri
                </button>
            )}
        </div>
    );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────
function RuleCard({
    rule,
    onToggle,
    onSaveParams,
    onDelete,
}: {
    rule: Rule;
    onToggle: () => void;
    onSaveParams: (params: string) => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm
            ${rule.enabled
                ? 'border-gray-200 bg-white'
                : 'border-dashed border-gray-300 bg-gray-50 opacity-70'}`}>

            {/* Header row */}
            <div className="flex items-center gap-4 px-5 py-4">
                {/* Icon */}
                <span className="text-2xl flex-shrink-0 w-10 text-center">
                    {RULE_ICONS[rule.code] ?? '⚙️'}
                </span>

                {/* Name + desc */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${rule.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                            {rule.name}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wide
                            ${rule.isBuiltin
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'bg-amber-100 text-amber-700'}`}>
                            {rule.isBuiltin ? '🔒 predefinita' : '✏️ custom'}
                        </span>
                        <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {rule.code}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{rule.description}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    <button
                        onClick={() => setExpanded(x => !x)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                        title="Espandi"
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {!rule.isBuiltin && (
                        <button
                            onClick={onDelete}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Elimina regola"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}

                    {/* Toggle */}
                    <button
                        onClick={onToggle}
                        className="flex items-center gap-1.5 transition"
                        title={rule.enabled ? 'Disabilita' : 'Abilita'}
                    >
                        {rule.enabled
                            ? <ToggleRight size={32} className="text-indigo-600" />
                            : <ToggleLeft size={32} className="text-gray-400" />}
                    </button>
                </div>
            </div>

            {/* Expandable detail */}
            {expanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
                    <p className="text-sm text-gray-600">{rule.description}</p>
                    <ParamEditor rule={rule} onSave={onSaveParams} />
                </div>
            )}
        </div>
    );
}

// ─── Add Custom Rule Modal ─────────────────────────────────────────────────────
function AddRuleModal({ onClose, onAdd }: { onClose: () => void; onAdd: (rule: Partial<Rule>) => void }) {
    const [form, setForm] = useState({ code: '', name: '', description: '', params: '{}' });
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!form.code.trim() || !form.name.trim()) { setError('Codice e nome sono obbligatori.'); return; }
        try { JSON.parse(form.params || '{}'); } catch { setError('Params deve essere JSON valido.'); return; }
        onAdd(form);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-indigo-500" /> Aggiungi Regola Personalizzata
                </h2>

                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">CODICE *</label>
                            <input
                                value={form.code}
                                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '_') }))}
                                placeholder="MY_RULE"
                                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">NOME *</label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="La mia regola"
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">DESCRIZIONE</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            rows={2}
                            placeholder="Descrivi cosa fa questa regola…"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                            PARAMETRI (JSON)
                        </label>
                        <textarea
                            value={form.params}
                            onChange={e => setForm(f => ({ ...f, params: e.target.value }))}
                            rows={3}
                            placeholder='{"chiave": "valore"}'
                            className="w-full font-mono border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-gray-50"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            ℹ️ I parametri custom vengono salvati nel DB ma richiedono codice nel scheduler per essere applicati.
                        </p>
                    </div>
                </div>

                {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

                <div className="flex justify-end gap-3 mt-5">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
                        Annulla
                    </button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition">
                        Aggiungi
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function RegolaPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        api.getProfile().then(setCurrentUser).catch(console.error);
    }, []);
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState<number | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

    const headers = { 'x-user-tenant-key': currentUser?.tenantKey ?? '' };

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/scheduling-rules', { headers });
            if (res.ok) setRules(await res.json());
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => { if (currentUser) load(); }, [currentUser]);

    const toggle = async (rule: Rule) => {
        setSaving(rule.id);
        try {
            const res = await fetch('/api/scheduling-rules', {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
            });
            if (res.ok) {
                setRules(r => r.map(x => x.id === rule.id ? { ...x, enabled: !x.enabled } : x));
                showToast(`Regola "${rule.name}" ${!rule.enabled ? 'abilitata' : 'disabilitata'}`);
            }
        } catch { showToast('Errore', 'err'); }
        finally { setSaving(null); }
    };

    const saveParams = async (rule: Rule, params: string) => {
        setSaving(rule.id);
        try {
            const res = await fetch('/api/scheduling-rules', {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: rule.id, params }),
            });
            if (res.ok) {
                setRules(r => r.map(x => x.id === rule.id ? { ...x, params } : x));
                showToast('Parametri salvati ✓');
            }
        } catch { showToast('Errore', 'err'); }
        finally { setSaving(null); }
    };

    const addRule = async (form: Partial<Rule>) => {
        try {
            const res = await fetch('/api/scheduling-rules', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setShowAddModal(false);
                await load();
                showToast('Regola aggiunta ✓');
            } else {
                const err = await res.json();
                showToast(err.error ?? 'Errore', 'err');
            }
        } catch { showToast('Errore di rete', 'err'); }
    };

    const deleteRule = async (rule: Rule) => {
        if (!confirm(`Eliminare la regola "${rule.name}"?`)) return;
        try {
            const res = await fetch(`/api/scheduling-rules?id=${rule.id}`, { method: 'DELETE', headers });
            if (res.ok) {
                setRules(r => r.filter(x => x.id !== rule.id));
                showToast('Regola eliminata');
            } else {
                const err = await res.json();
                showToast(err.error ?? 'Errore', 'err');
            }
        } catch { showToast('Errore', 'err'); }
    };

    const enabledCount = rules.filter(r => r.enabled).length;
    const builtinRules = rules.filter(r => r.isBuiltin);
    const customRules = rules.filter(r => !r.isBuiltin);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
                            <Shield size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">Regole Scheduler</h1>
                            <p className="text-xs text-gray-500">
                                {enabledCount} di {rules.length} regole attive
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition"
                    >
                        <Plus size={16} /> Aggiungi Regola
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

                {/* Stats bar */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { icon: <CheckCircle2 size={20} className="text-emerald-500" />, label: 'Attive', val: enabledCount, color: 'text-emerald-700' },
                        { icon: <AlertTriangle size={20} className="text-amber-500" />, label: 'Disabilitate', val: rules.length - enabledCount, color: 'text-amber-700' },
                        { icon: <Zap size={20} className="text-indigo-500" />, label: 'Personalizzate', val: customRules.length, color: 'text-indigo-700' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-3 shadow-sm">
                            {s.icon}
                            <div>
                                <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                                <p className="text-xs text-gray-500">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-20 text-gray-400">
                        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mr-3" />
                        Caricamento regole…
                    </div>
                )}

                {/* Built-in rules */}
                {!loading && builtinRules.length > 0 && (
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                            <Lock size={12} /> Regole Predefinite
                        </h2>
                        <div className="space-y-3">
                            {builtinRules.map(rule => (
                                <RuleCard
                                    key={rule.id}
                                    rule={rule}
                                    onToggle={() => toggle(rule)}
                                    onSaveParams={p => saveParams(rule, p)}
                                    onDelete={() => deleteRule(rule)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Custom rules */}
                {!loading && customRules.length > 0 && (
                    <section>
                        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                            <Settings size={12} /> Regole Personalizzate
                        </h2>
                        <div className="space-y-3">
                            {customRules.map(rule => (
                                <RuleCard
                                    key={rule.id}
                                    rule={rule}
                                    onToggle={() => toggle(rule)}
                                    onSaveParams={p => saveParams(rule, p)}
                                    onDelete={() => deleteRule(rule)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Info box */}
                {!loading && (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 flex gap-4">
                        <Info size={20} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-indigo-800 space-y-1">
                            <p className="font-semibold">Come funziona</p>
                            <p>Ogni volta che premi <strong>Auto</strong> nel calendario, il sistema carica queste regole dal database e le applica in tempo reale durante la generazione dei turni.</p>
                            <p>Le regole predefinite (🔒) possono essere disabilitate ma non eliminate. Le regole personalizzate (✏️) possono essere create, modificate ed eliminate liberamente.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <AddRuleModal onClose={() => setShowAddModal(false)} onAdd={addRule} />
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
                    ${toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
