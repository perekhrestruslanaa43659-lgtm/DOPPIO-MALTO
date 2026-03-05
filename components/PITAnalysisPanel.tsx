
'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, Users, Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type { WeekAnalysis, PITSlot, StaffPITLoad } from '@/lib/pitEngine';
import { getPITColor, getPITLabel, PIT_THRESHOLDS } from '@/lib/pitEngine';

// ─────────────────────────────────────────────────────────────────────────────

interface PITAnalysisPanelProps {
    data: WeekAnalysis | null;
    loading?: boolean;
    onRegenerateWithPIT?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PITBadge({ pit }: { pit: number }) {
    const color = getPITColor(pit);
    const label = getPITLabel(pit);
    const bgMap: Record<string, string> = {
        '#ef4444': 'bg-red-100 text-red-800 border-red-300',
        '#f59e0b': 'bg-amber-100 text-amber-800 border-amber-300',
        '#22c55e': 'bg-green-100 text-green-800 border-green-300',
    };
    const cls = bgMap[color] ?? 'bg-gray-100 text-gray-700 border-gray-300';
    return (
        <span className={`inline-flex flex-col items-center px-2 py-1 rounded-lg border text-xs font-bold gap-0.5 ${cls}`}>
            <span>{pit.toFixed(1)}</span>
            <span className="text-[9px] font-semibold opacity-80">{label}</span>
        </span>
    );
}

function SeniorRatioBadge({ ratio, total }: { ratio: number; total: number }) {
    if (total === 0) return <span className="text-xs text-gray-400 italic">—</span>;
    const pct = Math.round(ratio * 100);
    const ok = ratio >= 0.40;
    return (
        <span className={`text-xs font-semibold ${ok ? 'text-green-700' : 'text-red-600'}`}>
            {pct}% Senior
        </span>
    );
}

// ── PIT Heatmap ──────────────────────────────────────────────────────────────

function PITHeatmap({ slots }: { slots: PITSlot[] }) {
    // Group by date
    const byDate: Record<string, { PRANZO?: PITSlot; SERA?: PITSlot }> = {};
    slots.forEach(s => {
        if (!byDate[s.date]) byDate[s.date] = {};
        byDate[s.date][s.shiftType] = s;
    });

    const dates = Object.keys(byDate).sort();

    const dayName = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
    };

    const isDayWeekend = (dateStr: string) => {
        const dow = new Date(dateStr).getDay();
        return dow === 0 || dow === 5 || dow === 6;
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Turno</th>
                        {dates.map(d => (
                            <th
                                key={d}
                                className={`px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide ${isDayWeekend(d) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600'}`}
                            >
                                {dayName(d)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {(['PRANZO', 'SERA'] as const).map(type => (
                        <tr key={type} className="border-t border-gray-100">
                            <td className={`px-3 py-2 text-xs font-bold ${type === 'SERA' ? 'text-indigo-700' : 'text-sky-700'}`}>
                                {type === 'PRANZO' ? '☀️ Pranzo' : '🌙 Cena'}
                            </td>
                            {dates.map(d => {
                                const slot = byDate[d]?.[type];
                                if (!slot) return <td key={d} className="px-2 py-2 text-center"><span className="text-gray-300 text-xs">—</span></td>;
                                const hasViolation = slot.violations.length > 0;
                                return (
                                    <td key={d} className={`px-2 py-2 text-center ${isDayWeekend(d) ? 'bg-indigo-50/40' : ''}`}>
                                        <div className="flex flex-col items-center gap-1">
                                            <PITBadge pit={slot.pit} />
                                            <SeniorRatioBadge ratio={slot.seniorRatio} total={slot.totalCount} />
                                            {hasViolation && (
                                                <span title={slot.violations.join('\n')}>
                                                    <AlertTriangle size={12} className="text-red-500 mt-0.5" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Violations List ───────────────────────────────────────────────────────────

function ViolationsList({ violations }: { violations: PITSlot[] }) {
    if (violations.length === 0) {
        return (
            <div className="flex items-center gap-2 text-green-700 text-sm py-2">
                <CheckCircle size={15} />
                <span>Nessuna violazione ✓ — Presidio Senior rispettato su tutti i turni ad alta intensità</span>
            </div>
        );
    }
    return (
        <ul className="space-y-2">
            {(Array.isArray(violations) ? violations : []).map((v, i) => (
                <li key={i} className="flex items-start gap-2 bg-red-50 rounded-lg px-3 py-2 text-sm text-red-800 border border-red-200">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div>
                        <span className="font-semibold">
                            {new Date(v.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })} — {v.shiftType === 'SERA' ? 'Cena 🌙' : 'Pranzo ☀️'}
                        </span>
                        <span className="ml-2 font-mono text-xs bg-red-100 px-1 rounded">PIT {v.pit}</span>
                        <ul className="mt-1 space-y-0.5">
                            {(Array.isArray(v.violations) ? v.violations : []).map((vtext, j) => (
                                <li key={j} className="text-xs text-red-700">• {vtext}</li>
                            ))}
                        </ul>
                    </div>
                </li>
            ))}
        </ul>
    );
}

// ── Staff Load Table ──────────────────────────────────────────────────────────

function StaffLoadTable({ staffAnalysis }: { staffAnalysis: StaffPITLoad[] }) {
    // Only show staff with at least some hours or contribution
    const relevant = (Array.isArray(staffAnalysis) ? staffAnalysis : []).filter(s => s.hoursUsed > 0 || s.pitContribution > 0);

    if (relevant.length === 0) {
        return <p className="text-sm text-gray-500 italic">Nessun turno assegnato questa settimana.</p>;
    }

    const maxPIT = Math.max(...relevant.map(s => s.pitContribution), 1);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-2 py-2 font-semibold">Dipendente</th>
                        <th className="text-left px-2 py-2 font-semibold">Ruolo</th>
                        <th className="text-center px-2 py-2 font-semibold">Livello</th>
                        <th className="text-center px-2 py-2 font-semibold">Ore / MAX</th>
                        <th className="text-center px-2 py-2 font-semibold">Weekend</th>
                        <th className="text-center px-2 py-2 font-semibold">∑ PIT</th>
                    </tr>
                </thead>
                <tbody>
                    {relevant.map(s => {
                        const hoursRatio = s.hoursMax > 0 ? s.hoursUsed / s.hoursMax : 0;
                        const overHours = s.hoursUsed > s.hoursMax;
                        const pitRatio = s.pitContribution / maxPIT;
                        return (
                            <tr key={s.staffId} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="px-2 py-2 font-semibold text-gray-800">{s.nome} {s.cognome}</td>
                                <td className="px-2 py-2 text-gray-500 max-w-[100px] truncate" title={s.ruolo}>{s.ruolo}</td>
                                <td className="px-2 py-2 text-center">
                                    {s.isSenior ? (
                                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-[10px] font-bold">Senior</span>
                                    ) : (
                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">Junior</span>
                                    )}
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className={`font-bold ${overHours ? 'text-red-600' : 'text-gray-800'}`}>
                                            {s.hoursUsed.toFixed(1)}h / {s.hoursMax}h
                                        </span>
                                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${overHours ? 'bg-red-500' : hoursRatio > 0.85 ? 'bg-amber-500' : 'bg-green-500'}`}
                                                style={{ width: `${Math.min(100, hoursRatio * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <span className={`font-semibold ${s.weekendShiftsCount > 4 ? 'text-amber-600' : 'text-gray-700'}`}>
                                        {s.weekendShiftsCount}
                                    </span>
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="font-bold text-indigo-700">{s.pitContribution.toFixed(1)}</span>
                                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-indigo-400 transition-all"
                                                style={{ width: `${pitRatio * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

export default function PITAnalysisPanel({ data, loading = false, onRegenerateWithPIT }: PITAnalysisPanelProps) {
    const [expandedSection, setExpandedSection] = React.useState<'heatmap' | 'violations' | 'staff' | null>('heatmap');

    const toggle = (s: 'heatmap' | 'violations' | 'staff') =>
        setExpandedSection(prev => prev === s ? null : s);

    const metrics = useMemo(() => {
        if (!data) return null;
        const slots = Array.isArray(data.slots) ? data.slots : [];
        const highIntensitySlots = Array.isArray(data.highIntensitySlots) ? data.highIntensitySlots : [];
        const violations = Array.isArray(data.violations) ? data.violations : [];

        const highPIT = highIntensitySlots.length;
        const violationsCount = violations.length;
        const seniorPct = Math.round((data.seniorUtilization || 0) * 100);
        const maxPIT = slots.length > 0 ? Math.max(...slots.map(s => s.pit)) : 0;
        return { highPIT, violations: violationsCount, seniorPct, maxPIT };
    }, [data]);

    if (loading) {
        return (
            <div className="border-t border-indigo-200 bg-indigo-50/50 p-4 text-center text-sm text-indigo-700">
                <div className="animate-spin inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full mr-2" />
                Calcolo PIT in corso...
            </div>
        );
    }

    if (!data) {
        return (
            <div className="border-t border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
                Nessun dato PIT disponibile per questa settimana.
            </div>
        );
    }

    return (
        <div className="border border-indigo-200 rounded-xl bg-white shadow-sm overflow-hidden mb-4">
            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Zap size={18} className="text-yellow-300" />
                    <div>
                        <h2 className="text-white font-bold text-sm tracking-wide">Analisi PIT — Punteggio Intensità Turno</h2>
                        <p className="text-indigo-200 text-xs">Formula: PIT = H × D × V  |  Soglia Alta Intensità: {PIT_THRESHOLDS.MEDIUM}</p>
                    </div>
                </div>
                {onRegenerateWithPIT && (
                    <button
                        onClick={onRegenerateWithPIT}
                        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border border-white/30"
                    >
                        <Zap size={12} />
                        Rigenera con PIT
                    </button>
                )}
            </div>

            {/* ── KPI Row ── */}
            {metrics && (
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                    <div className="px-4 py-3 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">PIT Max</p>
                        <p className="text-xl font-black text-indigo-700">{metrics.maxPIT.toFixed(1)}</p>
                    </div>
                    <div className="px-4 py-3 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Turni Alta Int.</p>
                        <p className="text-xl font-black text-amber-600">{metrics.highPIT}</p>
                    </div>
                    <div className="px-4 py-3 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Violazioni</p>
                        <p className={`text-xl font-black ${metrics.violations > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {metrics.violations}
                        </p>
                    </div>
                    <div className="px-4 py-3 text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">% Senior (alta int.)</p>
                        <p className={`text-xl font-black ${metrics.seniorPct >= 40 ? 'text-green-600' : 'text-red-600'}`}>
                            {metrics.seniorPct}%
                        </p>
                    </div>
                </div>
            )}

            {/* ── Legend ── */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-600">
                <span className="font-semibold text-gray-500 mr-1">Legenda:</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-300 inline-block" /> Basso (&lt;2)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300 inline-block" /> Medio (2–3.5)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Alto (&gt;3.5)</span>
                <span className="ml-2 text-gray-400">H=Fascia oraria · D=Giorno · V=Volume prenotati</span>
            </div>

            {/* ── Sections ── */}
            <div className="divide-y divide-gray-100">

                {/* Heatmap */}
                <SectionHeader
                    title="Mappa Intensità Turni"
                    icon={<TrendingUp size={14} className="text-indigo-600" />}
                    expanded={expandedSection === 'heatmap'}
                    onClick={() => toggle('heatmap')}
                />
                {expandedSection === 'heatmap' && (
                    <div className="px-3 py-3">
                        <PITHeatmap slots={Array.isArray(data.slots) ? data.slots : []} />
                    </div>
                )}

                {/* Violations */}
                <SectionHeader
                    title={`Violazioni Presidio Senior (${(Array.isArray(data.violations) ? data.violations : []).length})`}
                    icon={<AlertTriangle size={14} className={(Array.isArray(data.violations) ? data.violations : []).length > 0 ? 'text-red-500' : 'text-green-500'} />}
                    expanded={expandedSection === 'violations'}
                    onClick={() => toggle('violations')}
                />
                {expandedSection === 'violations' && (
                    <div className="px-3 py-3">
                        <ViolationsList violations={Array.isArray(data.violations) ? data.violations : []} />
                    </div>
                )}

                {/* Staff Load */}
                <SectionHeader
                    title="Carico Lavoro Dipendenti"
                    icon={<Users size={14} className="text-sky-600" />}
                    expanded={expandedSection === 'staff'}
                    onClick={() => toggle('staff')}
                />
                {expandedSection === 'staff' && (
                    <div className="px-3 py-3">
                        <StaffLoadTable staffAnalysis={Array.isArray(data.staffAnalysis) ? data.staffAnalysis : []} />
                    </div>
                )}
            </div>
        </div>
    );
}

function SectionHeader({ title, icon, expanded, onClick }: {
    title: string; icon: React.ReactNode; expanded: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
        >
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                {icon}
                {title}
            </div>
            {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
    );
}
