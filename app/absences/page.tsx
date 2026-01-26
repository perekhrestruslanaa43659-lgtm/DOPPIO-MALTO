
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import QuarterTimeInput from '@/components/QuarterTimeInput';
import { CalendarOff, CalendarCheck, Trash2, Filter, AlertTriangle } from 'lucide-react';

interface Staff {
    id: number;
    nome: string;
    cognome: string;
}

interface ActivityItem {
    id: number;
    staffId: number;
    staff?: Staff;
    data: string;
    tipo: string; // "TOTALE", "PARZIALE", or "TURNO" (derived)
    reason?: string;
    activityType: 'UNAVAIL' | 'AVAIL';
    startTime?: string;
    endTime?: string;
}

// Helpers
function formatDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getWeekRange(w: number, year: number) {
    const d = new Date(year, 0, 4);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - (day - 1));
    d.setDate(d.getDate() + (w - 1) * 7);
    const start = formatDate(d);
    const dEnd = new Date(d);
    dEnd.setDate(d.getDate() + 6);
    const end = formatDate(dEnd);
    return { start, end };
}

export default function AbsencesPage() {
    const [activeTab, setActiveTab] = useState<'UNAVAIL' | 'AVAIL'>('UNAVAIL');
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [items, setItems] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Filters
    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');

    // Forms
    const [unavailForm, setUnavailForm] = useState({
        staffId: '',
        scope: 'single',
        date: '',
        startDate: '',
        endDate: '',
        startWeek: '',
        endWeek: '',
        selectedDays: [1],
        tipo: 'TOTALE',
        startTime: '',
        endTime: '',
        reason: ''
    });

    const [availForm, setAvailForm] = useState({
        staffId: '',
        scope: 'single',
        date: '',
        startDate: '',
        endDate: '',
        startWeek: '',
        endWeek: '',
        selectedDays: [1],
        startTime: '',
        endTime: ''
    });

    useEffect(() => {
        // Default range? Maybe last 30 days to future 90 days?
        // Or just fetch all if efficient? 
        // Legacy fetched based on filter or "recent"?
        const today = new Date();
        const start = new Date(today); start.setDate(start.getDate() - 7);
        const end = new Date(today); end.setMonth(end.getMonth() + 3);
        setFilterStart(formatDate(start));
        setFilterEnd(formatDate(end));
        loadData(formatDate(start), formatDate(end));
    }, []);

    const loadData = async (start: string, end: string) => {
        setLoading(true);
        try {
            // Emulate "getActivityHistory" by fetching both sources
            const [stf, unav, sch] = await Promise.all([
                api.getStaff(),
                api.getUnavailability(start, end),
                api.getSchedule(start, end)
            ]);

            setStaffList(stf as Staff[]);

            const mappedUnav = (unav as any[]).map(u => ({
                id: u.id,
                staffId: u.staffId,
                staff: (stf as Staff[]).find(s => s.id === u.staffId),
                data: u.data.split('T')[0],
                tipo: u.tipo,
                reason: u.reason,
                activityType: 'UNAVAIL' as const,
                startTime: u.start_time,
                endTime: u.end_time
            }));

            const mappedSch = (sch as any[]).map(a => ({
                id: a.id,
                staffId: a.staffId,
                staff: (stf as Staff[]).find(s => s.id === a.staffId),
                data: a.data.split('T')[0],
                tipo: `${a.start_time || a.shiftTemplate?.oraInizio || '?'} - ${a.end_time || a.shiftTemplate?.oraFine || '?'}`,
                reason: a.shiftTemplate?.nome || 'Manuale',
                activityType: 'AVAIL' as const
            }));

            // Merge and Sort
            let all = [...mappedUnav, ...mappedSch];
            all.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()); // Descending
            setItems(all);

        } catch (e: any) {
            alert("Errore: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (it: ActivityItem) => {
        if (!confirm("Eliminare questa voce?")) return;
        try {
            if (it.activityType === 'UNAVAIL') await api.deleteUnavailability(it.id);
            else await api.deleteAssignment(it.id);
            loadData(filterStart, filterEnd);
        } catch (e: any) { alert(e.message); }
    };

    const handleUnavailSubmit = async () => {
        const f = unavailForm;
        if (!f.staffId || !f.reason) { alert("Staff e Motivo sono obbligatori"); return; }

        if (submitting) return; // Prevent duplicate submissions

        let dates: string[] = [];
        if (f.scope === 'single') dates.push(f.date);
        else if (f.scope === 'daily_range') {
            let c = new Date(f.startDate);
            const e = new Date(f.endDate);
            while (c <= e) { dates.push(formatDate(c)); c.setDate(c.getDate() + 1); }
        } else if (f.scope === 'weekly_range') {
            for (let w = Number(f.startWeek); w <= Number(f.endWeek); w++) {
                const { start } = getWeekRange(w, 2025); // Hardcoded year for now
                const d = new Date(start);
                for (let i = 0; i < 7; i++) {
                    if (f.selectedDays.includes(d.getDay())) dates.push(formatDate(d));
                    d.setDate(d.getDate() + 1);
                }
            }
        }

        setSubmitting(true);
        try {
            for (const d of dates) {
                await api.upsertUnavailability({
                    staffId: Number(f.staffId),
                    data: d,
                    tipo: f.tipo,
                    reason: f.reason,
                    start_time: f.tipo === 'PARZIALE' ? f.startTime : null,
                    end_time: f.tipo === 'PARZIALE' ? f.endTime : null
                });
            }
            alert(`✅ Inserite ${dates.length} assenze con successo!`);

            // Reset form
            setUnavailForm({
                staffId: '',
                scope: 'single',
                date: '',
                startDate: '',
                endDate: '',
                startWeek: '',
                endWeek: '',
                selectedDays: [1],
                tipo: 'TOTALE',
                startTime: '',
                endTime: '',
                reason: ''
            });

            // Auto-refresh data
            await loadData(filterStart, filterEnd);
        } catch (e: any) {
            alert("❌ Errore: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleAvailSubmit = async () => {
        const f = availForm;
        if (!f.staffId || !f.startTime || !f.endTime) { alert("Dati mancanti"); return; }

        if (submitting) return; // Prevent duplicate submissions

        let dates: string[] = [];
        if (f.scope === 'single') dates.push(f.date);
        else if (f.scope === 'daily_range') {
            let c = new Date(f.startDate);
            const e = new Date(f.endDate);
            while (c <= e) { dates.push(formatDate(c)); c.setDate(c.getDate() + 1); }
        } else if (f.scope === 'weekly_range') {
            for (let w = Number(f.startWeek); w <= Number(f.endWeek); w++) {
                const { start } = getWeekRange(w, 2025);
                const d = new Date(start);
                for (let i = 0; i < 7; i++) {
                    if (f.selectedDays.includes(d.getDay())) dates.push(formatDate(d));
                    d.setDate(d.getDate() + 1);
                }
            }
        }

        let duplicates = 0;
        setSubmitting(true);
        try {
            for (const d of dates) {
                try {
                    await api.createAssignment({
                        staffId: Number(f.staffId),
                        data: d,
                        start_time: f.startTime,
                        end_time: f.endTime,
                        shiftTemplateId: null,
                        status: false
                    });
                } catch (err) { duplicates++; }
            }
            alert(`✅ Creati ${dates.length - duplicates} turni. (${duplicates} errori/duplicati)`);

            // Reset form
            setAvailForm({
                staffId: '',
                scope: 'single',
                date: '',
                startDate: '',
                endDate: '',
                startWeek: '',
                endWeek: '',
                selectedDays: [1],
                startTime: '',
                endTime: ''
            });

            // Auto-refresh
            await loadData(filterStart, filterEnd);
        } catch (e: any) {
            alert("❌ Errore: " + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const daysLabels = [{ l: 'Lun', v: 1 }, { l: 'Mar', v: 2 }, { l: 'Mer', v: 3 }, { l: 'Gio', v: 4 }, { l: 'Ven', v: 5 }, { l: 'Sab', v: 6 }, { l: 'Dom', v: 0 }];

    const toggleDay = (isUnavail: boolean, d: number) => {
        const setF = isUnavail ? setUnavailForm : setAvailForm;
        const f: any = isUnavail ? unavailForm : availForm;
        const curr = f.selectedDays;
        setF({ ...f, selectedDays: curr.includes(d) ? curr.filter((x: number) => x !== d) : [...curr, d] });
    };

    // Multi-select handlers
    const toggleSelectAll = () => {
        const unavailItems = items.filter(it => it.activityType === 'UNAVAIL');
        if (selectedIds.length === unavailItems.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(unavailItems.map(it => it.id));
        }
    };

    const toggleSelectItem = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Bulk delete handlers
    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) {
            alert("⚠️ Seleziona almeno un'assenza da eliminare");
            return;
        }

        if (!confirm(`Eliminare ${selectedIds.length} assenze selezionate?`)) return;

        setDeleting(true);
        try {
            await api.deleteMultipleUnavailability(selectedIds);
            alert(`✅ Eliminate ${selectedIds.length} assenze!`);
            setSelectedIds([]);
            await loadData(filterStart, filterEnd);
        } catch (e: any) {
            alert("❌ Errore: " + e.message);
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm("⚠️ ATTENZIONE: Eliminare TUTTE le assenze?")) return;
        if (!confirm("Sei sicuro? Questa operazione è IRREVERSIBILE!")) return;

        setDeleting(true);
        try {
            const result = await api.deleteAllUnavailability();
            alert(`✅ ${result.message}`);
            setSelectedIds([]);
            await loadData(filterStart, filterEnd);
        } catch (e: any) {
            alert("❌ Errore: " + e.message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
                        <AlertTriangle className="text-red-600" />
                        Registrazione Assenze (Impreviste)
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Registra qui assenze <strong>non pianificate</strong> (es. malattia, infortunio, emergenze comunicate all'ultimo).
                        <br />Per ferie o permessi richiesti in anticipo, usa la sezione <a href="/requests" className="text-blue-600 underline">Richieste</a>.
                    </p>
                </div>
            </div>

            <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('UNAVAIL')}
                    className={`pb-3 px-4 font-medium flex items-center gap-2 border-b-2 transition ${activeTab === 'UNAVAIL' ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <CalendarOff size={18} /> Inserisci Assenza
                </button>
                <button
                    onClick={() => setActiveTab('AVAIL')}
                    className={`pb-3 px-4 font-medium flex items-center gap-2 border-b-2 transition ${activeTab === 'AVAIL' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <CalendarCheck size={18} /> Inserisci Turni Massivi
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                {activeTab === 'UNAVAIL' ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="label block font-bold mb-1">Dipendente</label>
                                <select className="input w-full p-2 border rounded" value={unavailForm.staffId} onChange={e => setUnavailForm({ ...unavailForm, staffId: e.target.value })}>
                                    <option value="">Seleziona...</option>
                                    {staffList.map(s => <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label block font-bold mb-1">Periodo</label>
                                <select className="input w-full p-2 border rounded" value={unavailForm.scope} onChange={e => setUnavailForm({ ...unavailForm, scope: e.target.value })}>
                                    <option value="single">Giorno Singolo</option>
                                    <option value="daily_range">Range Date</option>
                                    <option value="weekly_range">Range Settimane</option>
                                </select>
                            </div>

                            {/* Dynamic Fields */}
                            {unavailForm.scope === 'single' && <div><label className="block font-bold mb-1">Data</label><input type="date" className="p-2 border rounded w-full" value={unavailForm.date} onChange={e => setUnavailForm({ ...unavailForm, date: e.target.value })} /></div>}
                            {unavailForm.scope === 'daily_range' && (
                                <>
                                    <div><label className="block font-bold mb-1">Da</label><input type="date" className="p-2 border rounded w-full" value={unavailForm.startDate} onChange={e => setUnavailForm({ ...unavailForm, startDate: e.target.value })} /></div>
                                    <div><label className="block font-bold mb-1">A</label><input type="date" className="p-2 border rounded w-full" value={unavailForm.endDate} onChange={e => setUnavailForm({ ...unavailForm, endDate: e.target.value })} /></div>
                                </>
                            )}
                            {unavailForm.scope === 'weekly_range' && (
                                <div className="col-span-full">
                                    <div className="flex gap-4 items-center">
                                        <div><label className="block font-bold mb-1">Sett. Inizio</label><input type="number" className="p-2 border rounded w-full" value={unavailForm.startWeek} onChange={e => setUnavailForm({ ...unavailForm, startWeek: e.target.value })} /></div>
                                        <div><label className="block font-bold mb-1">Sett. Fine</label><input type="number" className="p-2 border rounded w-full" value={unavailForm.endWeek} onChange={e => setUnavailForm({ ...unavailForm, endWeek: e.target.value })} /></div>
                                        <div>
                                            <label className="block font-bold mb-1">Giorni</label>
                                            <div className="flex gap-2">
                                                {daysLabels.map(d => (
                                                    <button key={d.v} onClick={() => toggleDay(true, d.v)} className={`px-2 py-1 rounded text-sm border ${unavailForm.selectedDays.includes(d.v) ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50'}`}>
                                                        {d.l}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block font-bold mb-1">Tipo Assenza</label>
                                    <select className="input w-full p-2 border rounded" value={unavailForm.tipo} onChange={e => setUnavailForm({ ...unavailForm, tipo: e.target.value })}>
                                        <option value="TOTALE">Tutto Il Giorno</option>
                                        <option value="PARZIALE">Parziale (Ore)</option>
                                    </select>
                                </div>
                                {unavailForm.tipo === 'PARZIALE' && (
                                    <div className="flex gap-4">
                                        <QuarterTimeInput label="Inizio" value={unavailForm.startTime} onChange={v => setUnavailForm({ ...unavailForm, startTime: v })} />
                                        <QuarterTimeInput label="Fine" value={unavailForm.endTime} onChange={v => setUnavailForm({ ...unavailForm, endTime: v })} />
                                    </div>
                                )}
                            </div>

                            <div className="col-span-full">
                                <label className="block font-bold mb-1">Categoria Assenza</label>
                                <select
                                    className="input w-full p-2 border rounded mb-3 bg-gray-50"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setUnavailForm({ ...unavailForm, reason: e.target.value });
                                        }
                                    }}
                                >
                                    <option value="">-- Seleziona o Scrivi Sotto --</option>
                                    <option value="Malattia">Malattia</option>
                                    <option value="Infortunio">Infortunio</option>
                                    <option value="Permesso Urgente 104">Permesso Urgente / 104</option>
                                    <option value="Assenza Ingiustificata">Assenza Ingiustificata</option>
                                    <option value="Lutto">Lutto</option>
                                    <option value="Altro">Altro (specificare sotto)</option>
                                </select>

                                <label className="block font-bold mb-1 text-red-600">Dettagli / Motivo (Obbligatorio)</label>
                                <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-red-500" placeholder="Es. Malattia, o dettagli aggiuntivi..." value={unavailForm.reason} onChange={e => setUnavailForm({ ...unavailForm, reason: e.target.value })} />
                            </div>

                            <div className="col-span-full">
                                <button
                                    onClick={handleUnavailSubmit}
                                    disabled={submitting}
                                    className={`w-full font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-2 ${submitting
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                        }`}
                                >
                                    {submitting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Elaborazione...
                                        </>
                                    ) : 'Registra Assenza'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* AVAIL FORM Similar structure */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="label block font-bold mb-1">Dipendente</label>
                                <select className="input w-full p-2 border rounded" value={availForm.staffId} onChange={e => setAvailForm({ ...availForm, staffId: e.target.value })}>
                                    <option value="">Seleziona...</option>
                                    {staffList.map(s => <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="label block font-bold mb-1">Periodo</label>
                                <select className="input w-full p-2 border rounded" value={availForm.scope} onChange={e => setAvailForm({ ...availForm, scope: e.target.value })}>
                                    <option value="single">Giorno Singolo</option>
                                    <option value="daily_range">Range Date</option>
                                    <option value="weekly_range">Range Settimane</option>
                                </select>
                            </div>

                            {/* Dynamic Fields */}
                            {availForm.scope === 'single' && <div><label className="block font-bold mb-1">Data</label><input type="date" className="p-2 border rounded w-full" value={availForm.date} onChange={e => setAvailForm({ ...availForm, date: e.target.value })} /></div>}
                            {availForm.scope === 'daily_range' && (
                                <>
                                    <div><label className="block font-bold mb-1">Da</label><input type="date" className="p-2 border rounded w-full" value={availForm.startDate} onChange={e => setAvailForm({ ...availForm, startDate: e.target.value })} /></div>
                                    <div><label className="block font-bold mb-1">A</label><input type="date" className="p-2 border rounded w-full" value={availForm.endDate} onChange={e => setAvailForm({ ...availForm, endDate: e.target.value })} /></div>
                                </>
                            )}
                            {availForm.scope === 'weekly_range' && (
                                <div className="col-span-full">
                                    <div className="flex gap-4 items-center">
                                        <div><label className="block font-bold mb-1">Sett. Inizio</label><input type="number" className="p-2 border rounded w-full" value={availForm.startWeek} onChange={e => setAvailForm({ ...availForm, startWeek: e.target.value })} /></div>
                                        <div><label className="block font-bold mb-1">Sett. Fine</label><input type="number" className="p-2 border rounded w-full" value={availForm.endWeek} onChange={e => setAvailForm({ ...availForm, endWeek: e.target.value })} /></div>
                                        <div>
                                            <label className="block font-bold mb-1">Giorni</label>
                                            <div className="flex gap-2">
                                                {daysLabels.map(d => (
                                                    <button key={d.v} onClick={() => toggleDay(false, d.v)} className={`px-2 py-1 rounded text-sm border ${availForm.selectedDays.includes(d.v) ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50'}`}>
                                                        {d.l}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="col-span-full flex gap-4 bg-green-50 p-4 rounded-lg">
                                <QuarterTimeInput label="Ora Inizio" value={availForm.startTime} onChange={v => setAvailForm({ ...availForm, startTime: v })} />
                                <QuarterTimeInput label="Ora Fine" value={availForm.endTime} onChange={v => setAvailForm({ ...availForm, endTime: v })} />
                            </div>

                            <div className="col-span-full">
                                <button
                                    onClick={handleAvailSubmit}
                                    disabled={submitting}
                                    className={`w-full font-bold py-3 rounded-lg shadow transition flex items-center justify-center gap-2 ${submitting
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                >
                                    {submitting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Elaborazione...
                                        </>
                                    ) : 'Genera Turni'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-gray-700">Cronologia Attività</h3>
                        <div className="flex gap-2 text-sm">
                            <input type="date" className="border rounded p-1" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
                            <span className="self-center">-</span>
                            <input type="date" className="border rounded p-1" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
                            <button onClick={() => loadData(filterStart, filterEnd)} className="bg-gray-800 text-white px-3 py-1 rounded">Filtra</button>
                        </div>
                    </div>
                    {items.filter(it => it.activityType === 'UNAVAIL').length > 0 && (
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.length === 0 || deleting}
                                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${selectedIds.length === 0 || deleting
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                                    }`}
                            >
                                <Trash2 size={16} />
                                {deleting ? 'Eliminazione...' : `Elimina Selezionate (${selectedIds.length})`}
                            </button>
                            <button
                                onClick={handleDeleteAll}
                                disabled={deleting}
                                className={`px-4 py-2 rounded-lg font-medium transition ${deleting
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                    }`}
                            >
                                {deleting ? 'Eliminazione...' : 'Cancella Tutte le Assenze'}
                            </button>
                        </div>
                    )}
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-gray-500 uppercase font-semibold">
                        <tr>
                            <th className="p-3 w-12">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length > 0 && selectedIds.length === items.filter(it => it.activityType === 'UNAVAIL').length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 cursor-pointer"
                                />
                            </th>
                            <th className="p-3">Staff</th>
                            <th className="p-3">Data</th>
                            <th className="p-3">Tipo / Orario</th>
                            <th className="p-3">Motivo / Dettagli</th>
                            <th className="p-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && <tr><td colSpan={6} className="p-4 text-center">Caricamento...</td></tr>}
                        {!loading && items.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">Nessuna attività trovata</td></tr>}
                        {items.map(it => (
                            <tr key={`${it.activityType}-${it.id}`} className="hover:bg-gray-50">
                                <td className="p-3">
                                    {it.activityType === 'UNAVAIL' ? (
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(it.id)}
                                            onChange={() => toggleSelectItem(it.id)}
                                            className="w-4 h-4 cursor-pointer"
                                        />
                                    ) : (
                                        <span className="w-4 h-4 inline-block"></span>
                                    )}
                                </td>
                                <td className="p-3 font-medium">{it.staff?.nome} {it.staff?.cognome}</td>
                                <td className="p-3">{it.data}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${it.activityType === 'UNAVAIL' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {it.activityType === 'UNAVAIL' ? 'ASSENZA' : 'TURNO'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs">{it.tipo}</span>
                                        {it.reason && <span className="text-gray-500 italic text-xs">{it.reason}</span>}
                                    </div>
                                </td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={() => handleDelete(it)}
                                        className="text-red-600 hover:text-red-800 hover:bg-red-100 p-2 rounded transition"
                                        title="Elimina"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
