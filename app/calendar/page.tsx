
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import QuarterTimeInput from '@/components/QuarterTimeInput';
import { Calendar, Save, Trash2, Download, Upload, AlertTriangle, CheckCircle, Wand2, Paintbrush } from 'lucide-react';

// --- Helpers ---
function getDatesInRange(startDate: string, endDate: string) {
    const dates = [];
    let curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

function getWeekRange(w: number, year: number = 2025) {
    const d = new Date(Date.UTC(year, 0, 4));
    const day = d.getUTCDay() || 7;
    const startOfYear = new Date(d);
    startOfYear.setUTCDate(d.getUTCDate() - day + 1);
    const startD = new Date(startOfYear);
    startD.setUTCDate(startOfYear.getUTCDate() + (w - 1) * 7);
    const start = startD.toISOString().split('T')[0];
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const end = endD.toISOString().split('T')[0];
    return { start, end };
}

// --- Interfaces ---
interface Assignment {
    id: number;
    staffId: number;
    data: string;
    start_time: string | null;
    end_time: string | null;
    shiftTemplateId: number | null;
    postazione: string;
    status: boolean;
    shiftTemplate?: any;
}

interface Staff {
    id: number;
    nome: string;
    cognome: string;
    listIndex: number;
    oreMassime: number;
    costoOra: number;
    ruolo: string;
    unavailabilities: any[];
    fixedShifts: any;
    postazioni: string[];
    moltiplicatore?: number;
}

interface ShiftTemplate {
    id: number;
    nome: string;
    oraInizio: string;
    oraFine: string;
    giorniValidi: any;
}

export default function CalendarPage() {
    const [schedule, setSchedule] = useState<Assignment[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [matrix, setMatrix] = useState<Record<number, Record<string, Assignment[]>>>({});
    const [unavailabilities, setUnavailabilities] = useState<any[]>([]);

    const [currentYear, setCurrentYear] = useState(2025);
    const [selectedWeek, setSelectedWeek] = useState(42);
    const [range, setRange] = useState(getWeekRange(42, 2025));

    const [panarelloActive, setPanarelloActive] = useState(false);
    const [editingCell, setEditingCell] = useState<any>(null);
    const [customTimes, setCustomTimes] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(false);

    // --- Persistence & Calculation ---
    useEffect(() => {
        // Restore from LocalStorage
        const savedWeek = localStorage.getItem('calendar_week');
        const savedYear = localStorage.getItem('calendar_year');

        let w = savedWeek ? parseInt(savedWeek) : 42; // Default fallback can be improved
        let y = savedYear ? parseInt(savedYear) : 2025;

        // Verify validity roughly
        if (isNaN(w) || w < 1 || w > 53) w = 42;
        if (isNaN(y)) y = 2025;

        setSelectedWeek(w);
        setCurrentYear(y);
        setRange(getWeekRange(w, y));
    }, []);

    useEffect(() => {
        loadData();
    }, [range]);

    const changeWeek = (w: number, y: number = currentYear) => {
        // Save to LocalStorage
        localStorage.setItem('calendar_week', w.toString());
        localStorage.setItem('calendar_year', y.toString());

        const r = getWeekRange(w, y);
        setRange(r);
        setSelectedWeek(w);
        setCurrentYear(y);
    };

    async function loadData() {
        setLoading(true);
        try {
            const [sch, stf, tmpl, unav] = await Promise.all([
                api.getSchedule(range.start, range.end),
                api.getStaff(),
                api.getShiftTemplates(),
                api.getUnavailability(range.start, range.end)
            ]);

            const safeSch = Array.isArray(sch) ? sch : [];
            setSchedule(safeSch);

            const safeStf = Array.isArray(stf) ? stf : [];
            // Sort staff by listIndex
            safeStf.sort((a: any, b: any) => (a.listIndex ?? 999) - (b.listIndex ?? 999));

            // Attach unavailabilities to staff for easier rendering check
            safeStf.forEach((s: any) => {
                s.unavailabilities = Array.isArray(unav) ? unav.filter((u: any) => u.staffId === s.id) : [];
            });
            setStaff(safeStf);

            setTemplates(Array.isArray(tmpl) ? tmpl : []);
            setUnavailabilities(Array.isArray(unav) ? unav : []);

            // Build Matrix
            const m: Record<number, Record<string, Assignment[]>> = {};
            safeStf.forEach((s: any) => { m[s.id] = {}; });
            safeSch.forEach((asn: any) => {
                if (!m[asn.staffId]) m[asn.staffId] = {};
                if (!m[asn.staffId][asn.data]) m[asn.staffId][asn.data] = [];
                m[asn.staffId][asn.data].push(asn);
            });
            setMatrix(m);

        } catch (e: any) {
            alert("Errore caricamento dati: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    // --- Calculations ---
    const days = getDatesInRange(range.start, range.end);
    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

    const calcHours = (start: string | null, end: string | null) => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
        if (diff < 0) diff += 24;
        return Math.round(diff * 100) / 100;
    };

    const getStats = () => {
        let totalAssignedHours = 0;
        let totalContractHours = 0;
        let totalCost = 0;

        staff.forEach(s => {
            totalContractHours += (s.oreMassime || 0);
            let staffHours = 0;
            const sMatrix = matrix[s.id] || {};
            Object.keys(sMatrix).forEach(d => {
                sMatrix[d].forEach(a => {
                    const sT = a.start_time || a.shiftTemplate?.oraInizio;
                    const eT = a.end_time || a.shiftTemplate?.oraFine;
                    if (sT && eT) staffHours += calcHours(sT, eT);
                });
            });
            totalAssignedHours += staffHours;
            totalCost += staffHours * (s.costoOra || 0);
        });
        return { totalAssignedHours, totalContractHours, totalCost, diff: totalContractHours - totalAssignedHours };
    };
    const stats = getStats();

    // --- Actions ---
    const generate = async () => {
        if (!confirm("Generare i turni sovrascriverà eventuali bozze. Continuare?")) return;
        try {
            setLoading(true);
            const res = await api.generateSchedule(range.start, range.end) as any;
            alert(`Generati ${res.generated} turni.`);
            loadData();
        } catch (e: any) {
            alert("Errore generazione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const clearAll = async () => {
        if (!confirm("Cancellare tutti i turni visualizzati?")) return;
        try {
            await api.clearAssignments(range.start, range.end);
            loadData();
        } catch (e: any) { alert(e.message) }
    };

    // --- Rendering Helpers ---
    const getShift = (staffId: number, date: string, type: 'PRANZO' | 'SERA') => {
        const list = matrix[staffId]?.[date] || [];
        return list.find(a => {
            const sT = a.start_time || a.shiftTemplate?.oraInizio;
            if (!sT) return false;
            const h = parseInt(sT.split(':')[0]);
            return type === 'PRANZO' ? h < 17 : h >= 17;
        });
    };

    // --- Cell Interaction ---
    const handleCellClick = (staffId: number, date: string, type: string, currentAsn: Assignment | undefined) => {
        if (panarelloActive && currentAsn) {
            // Toggle status logic
            api.updateAssignment(currentAsn.id, { ...currentAsn, status: !currentAsn.status })
                .then(() => loadData())
                .catch(e => alert(e.message));
            return;
        }

        const d = new Date(date);
        const currentDayName = dayNames[d.getDay()];

        const filteredTemplates = templates.filter(t => {
            // Filter logic from legacy
            // Not rigorously strictly copying every suffix rule for brevity unless critical
            // But implementing basic time check
            const startH = parseInt((t.oraInizio || '00:00').split(':')[0]);
            if (type.includes('Pranzo') && startH >= 17) return false;
            if (type.includes('Sera') && startH < 17) return false;
            return true;
        });

        setEditingCell({ staffId, date, type, currentAsn, filteredTemplates });
        if (currentAsn) {
            setCustomTimes({
                start: currentAsn.start_time || currentAsn.shiftTemplate?.oraInizio || '',
                end: currentAsn.end_time || currentAsn.shiftTemplate?.oraFine || ''
            });
        } else {
            setCustomTimes({ start: '', end: '' });
        }
    };

    const saveEdit = async (val: string) => {
        if (!editingCell) return;
        const { staffId, date, type, currentAsn } = editingCell;

        try {
            if (type.includes('Post')) {
                if (currentAsn) await api.updateAssignment(currentAsn.id, { postazione: val });
                else if (val) alert("Crea prima un turno per assegnare la postazione.");
            } else {
                // Time/Template
                let newTmplId = val === 'MANUAL' ? null : (val ? Number(val) : null);

                if (!newTmplId && !customTimes.start && !currentAsn) {
                    alert("Nessun dato inserito"); return;
                }

                // Deletion
                if (!newTmplId && !customTimes.start && currentAsn) {
                    await api.deleteAssignment(currentAsn.id);
                } else {
                    // Create/Update
                    const payload = {
                        shiftTemplateId: newTmplId,
                        start_time: customTimes.start || null,
                        end_time: customTimes.end || null,
                        status: currentAsn ? currentAsn.status : false // Keep status or default Draft
                    };

                    if (currentAsn) await api.updateAssignment(currentAsn.id, payload);
                    else await api.createAssignment({ staffId, data: date, ...payload });
                }
            }
            setEditingCell(null);
            loadData();
        } catch (e: any) {
            alert("Errore salvataggio: " + e.message);
        }
    };


    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
            {/* Header Control Panel */}
            <div className="bg-white shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between z-30">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <Calendar className="text-indigo-600" />
                        Turni
                    </h1>

                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                        <div className="flex flex-col px-2">
                            <span className="text-[10px] uppercase text-gray-500 font-bold">Anno</span>
                            <input
                                type="number"
                                className="bg-transparent font-bold w-16 text-sm outline-none"
                                value={currentYear}
                                onChange={e => changeWeek(selectedWeek, parseInt(e.target.value))}
                            />
                        </div>
                        <div className="w-px h-8 bg-gray-300"></div>
                        <div className="flex flex-col px-2">
                            <span className="text-[10px] uppercase text-gray-500 font-bold">Settimana</span>
                            <select
                                className="bg-transparent font-bold text-sm outline-none cursor-pointer"
                                value={selectedWeek}
                                onChange={e => changeWeek(parseInt(e.target.value))}
                            >
                                {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                                    <option key={w} value={w}>Week {w}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="text-sm text-gray-600">
                        {range.start.split('-').reverse().join('/')} - {range.end.split('-').reverse().join('/')}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={generate} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-bold transition">
                        <Wand2 size={14} /> AI Expert
                    </button>
                    <div className="h-6 w-px bg-gray-300 mx-1"></div>
                    <button
                        onClick={() => setPanarelloActive(!panarelloActive)}
                        className={`p-2 rounded transition ${panarelloActive ? 'bg-yellow-300 shadow-md ring-2 ring-yellow-400' : 'bg-gray-200 text-gray-600'}`}
                        title="Modalità Panarello (Conferma Rapida)"
                    >
                        <Paintbrush size={16} />
                    </button>
                    <button onClick={clearAll} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition" title="Cancella Tutto">
                        <Trash2 size={16} />
                    </button>
                    <div className="bg-gray-100 flex gap-4 px-3 py-1.5 rounded items-center text-xs">
                        <div><span className="text-gray-500">Bdgt:</span> <strong>{stats.totalContractHours}h</strong></div>
                        <div><span className="text-gray-500">Eff:</span> <strong>{stats.totalAssignedHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}h</strong></div>
                        <div className={`${stats.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}><strong>Diff: {stats.diff.toFixed(1)}h</strong></div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto relative">
                <table className="w-full border-collapse text-xs min-w-[1800px]">
                    <thead className="bg-white sticky top-0 z-20 shadow-sm text-gray-600">
                        <tr>
                            <th className="sticky left-0 bg-white border-b border-r p-2 min-w-[40px] z-30">#</th>
                            <th className="sticky left-[40px] bg-white border-b border-r p-2 min-w-[150px] text-left z-30">Staff</th>
                            <th className="sticky left-[190px] bg-white border-b border-r p-2 min-w-[50px] z-30">Ctr.</th>
                            <th className="sticky left-[240px] bg-white border-b border-r p-2 min-w-[50px] z-30">Eff.</th>
                            {days.map((d, i) => (
                                <th key={d} colSpan={6} className="border-b border-r p-1 text-center bg-gray-50">
                                    <div className="font-bold text-gray-800">{new Date(d).toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                                    <div className="text-[10px] text-gray-500">{d.split('-').slice(1).join('/')}</div>
                                </th>
                            ))}
                        </tr>
                        <tr>
                            <th className="sticky left-0 bg-white border-b border-r z-30"></th>
                            <th className="sticky left-[40px] bg-white border-b border-r z-30"></th>
                            <th className="sticky left-[190px] bg-white border-b border-r z-30"></th>
                            <th className="sticky left-[240px] bg-white border-b border-r z-30"></th>
                            {days.map(d => (
                                <React.Fragment key={d + '_sub'}>
                                    <th className="bg-blue-50/50 border-b border-gray-200 text-[9px] w-10 text-center font-normal">IN</th>
                                    <th className="bg-blue-50/50 border-b border-gray-200 text-[9px] w-10 text-center font-normal">OUT</th>
                                    <th className="bg-blue-50/50 border-b border-r border-gray-200 text-[9px] w-12 text-center font-normal">POST</th>
                                    <th className="bg-indigo-50/50 border-b border-gray-200 text-[9px] w-10 text-center font-normal">IN</th>
                                    <th className="bg-indigo-50/50 border-b border-gray-200 text-[9px] w-10 text-center font-normal">OUT</th>
                                    <th className="bg-indigo-50/50 border-b border-r-2 border-gray-300 text-[9px] w-12 text-center font-normal">POST</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {staff.map((s, idx) => {
                            let totalHours = 0;
                            // Calculate total for this row
                            Object.values(matrix[s.id] || {}).flat().forEach(a => {
                                const st = a.start_time || a.shiftTemplate?.oraInizio;
                                const et = a.end_time || a.shiftTemplate?.oraFine;
                                if (st && et) totalHours += calcHours(st, et);
                            });

                            // Budget checks
                            const budgetDiff = totalHours - (s.oreMassime || 0);
                            const budgetColor = budgetDiff > 2 ? 'bg-red-50 text-red-700' : (budgetDiff < -2 ? 'bg-blue-50 text-blue-700' : 'text-gray-600');

                            return (
                                <tr key={s.id} className="hover:bg-gray-50 border-b border-gray-100 group">
                                    <td className="sticky left-0 bg-white border-r p-2 text-center text-gray-400 group-hover:bg-gray-50 z-10">{idx + 1}</td>
                                    <td className="sticky left-[40px] bg-white border-r p-2 font-medium text-gray-800 text-left group-hover:bg-gray-50 z-10 truncate max-w-[150px]">{s.nome} {s.cognome}</td>
                                    <td className="sticky left-[190px] bg-white border-r p-2 text-center text-gray-500 group-hover:bg-gray-50 z-10">{s.oreMassime}</td>
                                    <td className={`sticky left-[240px] bg-white border-r p-2 text-center font-bold z-10 ${budgetColor} group-hover:bg-gray-50`}>{totalHours.toFixed(1)}</td>
                                    {days.map(d => {
                                        const lunch = getShift(s.id, d, 'PRANZO');
                                        const dinner = getShift(s.id, d, 'SERA');

                                        const renderCell = (asn: Assignment | undefined, type: string, bgColor: string) => {
                                            // Check unavailability
                                            const unavail = s.unavailabilities.find((u: any) => u.data.startsWith(d) && (u.tipo === 'TOTALE' || u.tipo === (type.includes('Pranzo') ? 'PRANZO' : 'SERA')));

                                            if (unavail) {
                                                return { bg: 'bg-red-100', text: 'N/A', disabled: true };
                                            }

                                            if (!asn) return { bg: bgColor, text: '', disabled: false };

                                            let text = '';
                                            if (type.includes('Post')) text = asn.postazione || '-';
                                            else {
                                                const st = asn.start_time || asn.shiftTemplate?.oraInizio;
                                                const et = asn.end_time || asn.shiftTemplate?.oraFine;
                                                if (type.includes('In')) text = st || '';
                                                if (type.includes('Out')) text = et || '';
                                            }

                                            // Status Color
                                            let bg = bgColor;
                                            if (asn && type.includes('Post')) bg = asn.status ? 'bg-green-100 text-green-800 font-bold' : 'bg-yellow-50 text-yellow-800';

                                            return { bg, text, disabled: false };
                                        };

                                        // Lunch Cells
                                        const lIn = renderCell(lunch, 'Turno1_In', 'bg-white');
                                        const lOut = renderCell(lunch, 'Turno1_Out', 'bg-white');
                                        const lPost = renderCell(lunch, 'Turno1_Post', 'bg-white');

                                        // Dinner Cells
                                        const dIn = renderCell(dinner, 'Turno2_In', 'bg-gray-50/30');
                                        const dOut = renderCell(dinner, 'Turno2_Out', 'bg-gray-50/30');
                                        const dPost = renderCell(dinner, 'Turno2_Post', 'bg-gray-50/30');

                                        return (
                                            <React.Fragment key={d}>
                                                <td onClick={() => !lIn.disabled && handleCellClick(s.id, d, 'Pranzo_In', lunch)} className={`border-r border-gray-100 p-1 text-center cursor-pointer hover:brightness-95 ${lIn.bg}`}>{lIn.text}</td>
                                                <td onClick={() => !lOut.disabled && handleCellClick(s.id, d, 'Pranzo_Out', lunch)} className={`border-r border-gray-100 p-1 text-center cursor-pointer hover:brightness-95 ${lOut.bg}`}>{lOut.text}</td>
                                                <td onClick={() => !lPost.disabled && handleCellClick(s.id, d, 'Pranzo_Post', lunch)} className={`border-r-2 border-gray-200 p-1 text-center cursor-pointer hover:brightness-95 ${lPost.bg} text-[10px]`}>{lPost.text}</td>

                                                <td onClick={() => !dIn.disabled && handleCellClick(s.id, d, 'Sera_In', dinner)} className={`border-r border-gray-100 p-1 text-center cursor-pointer hover:brightness-95 ${dIn.bg}`}>{dIn.text}</td>
                                                <td onClick={() => !dOut.disabled && handleCellClick(s.id, d, 'Sera_Out', dinner)} className={`border-r border-gray-100 p-1 text-center cursor-pointer hover:brightness-95 ${dOut.bg}`}>{dOut.text}</td>
                                                <td onClick={() => !dPost.disabled && handleCellClick(s.id, d, 'Sera_Post', dinner)} className={`border-r-2 border-gray-300 p-1 text-center cursor-pointer hover:brightness-95 ${dPost.bg} text-[10px]`}>{dPost.text}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Editing Modal */}
            {editingCell && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditingCell(null)}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px]" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Modifica Turno</h3>
                        <div className="mb-4 text-sm text-gray-600">
                            {staff.find(s => s.id === editingCell.staffId)?.nome} - {new Date(editingCell.date).toLocaleDateString('it-IT')} ({editingCell.type})
                        </div>

                        {editingCell.type.includes('Post') ? (
                            <div className="space-y-4">
                                <label className="block text-sm font-medium">Postazione</label>
                                <select id="editPost" className="w-full p-2 border rounded" defaultValue={editingCell.currentAsn?.postazione}>
                                    <option value="">- Seleziona -</option>
                                    {['BARGIU', 'BARSU', 'ACCSU', 'CDR', 'B/S', 'CUCINA', 'MANAGER'].map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <button onClick={() => saveEdit((document.getElementById('editPost') as HTMLSelectElement).value)} className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Salva Postazione</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Turno Predefinito</label>
                                    <select
                                        id="editTmpl"
                                        className="w-full p-2 border rounded"
                                        defaultValue={editingCell.currentAsn?.shiftTemplateId || ''}
                                        onChange={(e) => {
                                            const t = templates.find(x => x.id === Number(e.target.value));
                                            if (t) setCustomTimes({ start: t.oraInizio, end: t.oraFine });
                                        }}
                                    >
                                        <option value="">(Nessuno / Manuale)</option>
                                        <option value="MANUAL">-- Personalizzato --</option>
                                        {editingCell.filteredTemplates?.map((t: any) => (
                                            <option key={t.id} value={t.id}>{t.nome} ({t.oraInizio}-{t.oraFine})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex gap-4 p-3 bg-gray-50 rounded">
                                    <QuarterTimeInput label="Start" value={customTimes.start} onChange={v => setCustomTimes({ ...customTimes, start: v })} />
                                    <QuarterTimeInput label="End" value={customTimes.end} onChange={v => setCustomTimes({ ...customTimes, end: v })} />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => saveEdit((document.getElementById('editTmpl') as HTMLSelectElement).value)} className="flex-1 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium">Salva</button>
                                    {editingCell.currentAsn && (
                                        <button onClick={() => { if (confirm('Eliminare?')) saveEdit('') }} className="px-3 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200">
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {loading && (
                <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2 animate-pulse">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    Caricamento...
                </div>
            )}
        </div>
    );
}
