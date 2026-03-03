
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Save, Star, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useCtrlS } from '@/hooks/useCtrlS';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Competency {
    id?: number;
    staffId: number;
    postazione: string;
    score: number;
    note: string;
}

interface StaffInfo {
    id: number;
    nome: string;
    cognome: string;
    ruolo: string;
    skillLevel: string;
    postazioni: string[];
}

// ─── Score → Level Mapping ─────────────────────────────────────────────────────

function scoreToLevel(score: number) {
    if (score <= 1) return { label: 'Non abilitato', emoji: '✗', color: 'text-gray-500', badge: 'bg-gray-100 text-gray-600 border-gray-300' };
    if (score === 2) return { label: 'In formazione', emoji: '📚', color: 'text-amber-700', badge: 'bg-amber-50 text-amber-800 border-amber-300' };
    if (score === 3) return { label: 'Junior', emoji: '🔵', color: 'text-blue-700', badge: 'bg-blue-50 text-blue-800 border-blue-300' };
    if (score === 4) return { label: 'Senior', emoji: '🟢', color: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
    return { label: 'Senior ★', emoji: '⭐', color: 'text-yellow-700', badge: 'bg-yellow-50 text-yellow-800 border-yellow-400' };
}

// ─── Star Selector ─────────────────────────────────────────────────────────────

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [hovered, setHovered] = useState(0);
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => onChange(n)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                >
                    <Star
                        size={26}
                        className={`transition-colors ${(hovered || value) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                </button>
            ))}
        </div>
    );
}

// ─── Level Badge ───────────────────────────────────────────────────────────────

function LevelBadge({ score }: { score: number }) {
    const l = scoreToLevel(score);
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${l.badge}`}>
            <span className="text-sm">{l.emoji}</span>
            {l.label}
        </span>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CompetenzePage({ params }: { params: { id: string } }) {
    const staffId = Number(params.id);

    const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
    const [competencies, setCompetencies] = useState<Record<string, Competency>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [savingAll, setSavingAll] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [newPostazione, setNewPostazione] = useState('');
    const [allStations, setAllStations] = useState<string[]>([]);

    // Fetch staff info
    useEffect(() => {
        async function load() {
            try {
                const [staffRes, compRes, allStaffRes] = await Promise.all([
                    fetch(`/api/staff?id=${staffId}`),
                    fetch(`/api/staff/competencies?staffId=${staffId}`),
                    fetch('/api/staff'),
                ]);

                if (staffRes.ok) {
                    const s = await staffRes.json();
                    // Handle both array and single object response
                    const info = Array.isArray(s) ? s.find((x: any) => x.id === staffId) : s;
                    if (info) {
                        setStaffInfo({
                            ...info,
                            postazioni: Array.isArray(info.postazioni)
                                ? info.postazioni
                                : JSON.parse(info.postazioni || '[]'),
                        });
                    }
                }

                if (compRes.ok) {
                    const comps: Competency[] = await compRes.json();
                    const map: Record<string, Competency> = {};
                    comps.forEach(c => { map[c.postazione] = c; });
                    setCompetencies(map);
                }

                // Collect all stations from all staff
                if (allStaffRes.ok) {
                    const allStaff: any[] = await allStaffRes.json();
                    const stations = new Set<string>();
                    allStaff.forEach(s => {
                        const posts = Array.isArray(s.postazioni) ? s.postazioni : JSON.parse(s.postazioni || '[]');
                        posts.forEach((p: string) => stations.add(p));
                    });
                    setAllStations(Array.from(stations).sort());
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [staffId]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const saveCompetency = async (postazione: string, score: number, note: string) => {
        setSaving(postazione);
        try {
            const res = await fetch('/api/staff/competencies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffId, postazione, score, note }),
            });
            if (!res.ok) throw new Error('Errore salvataggio');
            const updated = await res.json();
            setCompetencies(prev => ({ ...prev, [postazione]: updated }));
            showToast(`✓ ${postazione} salvata`);
        } catch (e: any) {
            showToast('❌ ' + e.message);
        } finally {
            setSaving(null);
        }
    };

    const deleteCompetency = async (postazione: string, id?: number) => {
        if (!id) {
            setCompetencies(prev => { const n = { ...prev }; delete n[postazione]; return n; });
            return;
        }
        try {
            await fetch(`/api/staff/competencies?id=${id}`, { method: 'DELETE' });
            setCompetencies(prev => { const n = { ...prev }; delete n[postazione]; return n; });
            showToast(`Rimosso: ${postazione}`);
        } catch (e: any) {
            showToast('❌ ' + e.message);
        }
    };

    const setScore = (postazione: string, score: number) => {
        setCompetencies(prev => ({
            ...prev,
            [postazione]: { ...prev[postazione] ?? { staffId, postazione, score, note: '' }, score },
        }));
    };

    const setNote = (postazione: string, note: string) => {
        setCompetencies(prev => ({
            ...prev,
            [postazione]: { ...prev[postazione] ?? { staffId, postazione, score: 3, note }, note },
        }));
    };

    const addNewPostazione = () => {
        const p = newPostazione.trim().toUpperCase();
        if (!p) return;
        if (!competencies[p]) {
            setCompetencies(prev => ({ ...prev, [p]: { staffId, postazione: p, score: 3, note: '' } }));
        }
        setNewPostazione('');
    };

    // ── Ctrl+S: save all competencies with a score ──────────────────────────
    const saveAll = useCallback(async () => {
        const toSave = Object.values(competencies).filter(c => c.score > 0);
        if (toSave.length === 0) { showToast('Niente da salvare'); return; }
        setSavingAll(true);
        try {
            await Promise.all(
                toSave.map(c =>
                    fetch('/api/staff/competencies', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ staffId, postazione: c.postazione, score: c.score, note: c.note }),
                    })
                )
            );
            showToast(`✓ ${toSave.length} competenz${toSave.length === 1 ? 'a' : 'e'} salvate`);
        } catch {
            showToast('❌ Errore salvataggio globale');
        } finally {
            setSavingAll(false);
        }
    }, [competencies, staffId]);

    useCtrlS(saveAll);

    const ownPostazioni = staffInfo?.postazioni ?? [];
    const extraPostazioni = Object.keys(competencies).filter(p => !ownPostazioni.includes(p));
    const allTabPostazioni = [...ownPostazioni, ...extraPostazioni];

    // Summary stats
    const seniorCount = allTabPostazioni.filter(p => (competencies[p]?.score ?? 0) >= 4).length;
    const juniorCount = allTabPostazioni.filter(p => competencies[p]?.score === 3).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            {/* Toast */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-2.5 rounded-xl shadow-2xl text-sm font-medium animate-bounce">
                    {toast}
                </div>
            )}

            <div className="max-w-4xl mx-auto">
                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-6">
                    <Link href="/staff" className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg transition-all">
                        <ChevronLeft size={22} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">
                            Competenze — {staffInfo?.nome} {staffInfo?.cognome}
                        </h1>
                        <p className="text-sm text-gray-500">{staffInfo?.ruolo} · Valuta le postazioni per questo dipendente</p>
                    </div>
                </div>

                {/* ── Summary KPIs ── */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Postazioni</p>
                        <p className="text-3xl font-black text-gray-900">{allTabPostazioni.length}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center shadow-sm">
                        <p className="text-xs text-emerald-700 uppercase tracking-wide font-semibold">Senior</p>
                        <p className="text-3xl font-black text-emerald-700">{seniorCount}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center shadow-sm">
                        <p className="text-xs text-blue-700 uppercase tracking-wide font-semibold">Junior</p>
                        <p className="text-3xl font-black text-blue-700">{juniorCount}</p>
                    </div>
                </div>

                {/* ── Score Guide ── */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Legenda Punteggi</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map(n => {
                            const l = scoreToLevel(n);
                            return (
                                <div key={n} className={`flex flex-col items-center p-2 rounded-lg border ${l.badge}`}>
                                    <div className="flex">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <Star key={i} size={12} className={i <= n ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                                        ))}
                                    </div>
                                    <span className="text-xs font-bold mt-1">{l.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Competency Cards ── */}
                <div className="space-y-3 mb-6">
                    {allTabPostazioni.length === 0 && (
                        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
                            <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
                            <p>Nessuna postazione abilitata per questo dipendente.</p>
                            <p className="text-sm mt-1">Aggiungi postazioni dalla pagina Staff o usa il campo qui sotto.</p>
                        </div>
                    )}

                    {allTabPostazioni.map(postazione => {
                        const comp = competencies[postazione] ?? { staffId, postazione, score: 0, note: '' };
                        const level = scoreToLevel(comp.score);
                        const isDirty = comp.score > 0;

                        return (
                            <div
                                key={postazione}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-4"
                            >
                                {/* Postazione name */}
                                <div className="w-36 shrink-0">
                                    <p className="font-bold text-gray-900 text-sm">{postazione}</p>
                                    {extraPostazioni.includes(postazione) && (
                                        <span className="text-[10px] text-gray-400">extra</span>
                                    )}
                                </div>

                                {/* Stars */}
                                <div className="flex-1">
                                    <StarSelector
                                        value={comp.score}
                                        onChange={score => setScore(postazione, score)}
                                    />
                                </div>

                                {/* Level Badge */}
                                <div className="w-36 shrink-0">
                                    <LevelBadge score={comp.score} />
                                </div>

                                {/* Note */}
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="Note opzionali..."
                                        value={comp.note ?? ''}
                                        onChange={e => setNote(postazione, e.target.value)}
                                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 placeholder-gray-300"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => saveCompetency(postazione, comp.score, comp.note ?? '')}
                                        disabled={saving === postazione || comp.score === 0}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${comp.score === 0
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-sm'
                                            }`}
                                    >
                                        {saving === postazione ? (
                                            <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                                        ) : (
                                            <Save size={13} />
                                        )}
                                        Salva
                                    </button>
                                    <button
                                        onClick={() => deleteCompetency(postazione, comp.id)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Rimuovi"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Add Extra Postazione ── */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Aggiungi Postazione Extra</h3>
                    <div className="flex gap-2 flex-wrap">
                        {allStations.filter(s => !allTabPostazioni.includes(s)).map(s => (
                            <button
                                key={s}
                                onClick={() => {
                                    setCompetencies(prev => ({ ...prev, [s]: { staffId, postazione: s, score: 3, note: '' } }));
                                }}
                                className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors font-medium"
                            >
                                + {s}
                            </button>
                        ))}
                        <div className="flex items-center gap-2 ml-2">
                            <input
                                type="text"
                                placeholder="Nuova postazione..."
                                value={newPostazione}
                                onChange={e => setNewPostazione(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === 'Enter' && addNewPostazione()}
                                className="text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 w-40"
                            />
                            <button
                                onClick={addNewPostazione}
                                className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
