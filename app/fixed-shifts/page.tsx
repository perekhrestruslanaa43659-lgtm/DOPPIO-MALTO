
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Trash2, User, Plus, Calendar, Clock, MapPin, Pencil, Save, X, Repeat } from 'lucide-react';
import Link from 'next/link';
import { DEFAULT_STATIONS } from '@/lib/constants';

interface RecurringShift {
    id: number;
    staffId: number;
    dayOfWeek: number;
    start_time: string;
    end_time: string;
    postazione: string;
    staff: { nome: string; cognome: string };
    shiftTemplate?: { id: number; name: string };
    startWeek?: number | null;
    endWeek?: number | null;
    startYear?: number | null;
    endYear?: number | null;
}

interface NewShift {
    staffId: number;
    daysOfWeek: number[];
    start_time: string;
    end_time: string;
    postazione: string;
    shiftTemplateId?: number;
    startWeek?: number;
    endWeek?: number;
    startYear?: number;
    endYear?: number;
}

const TEMPLATES = [
    { label: 'Manuale (Personalizzato)', value: 0 },
    { label: 'Pranzo (9:00 - 15:00)', start: '09:00', end: '15:00' },
    { label: 'Cena (17:00 - 23:00)', start: '17:00', end: '23:00' },
    { label: 'Spezzato (10-14 / 18-22)', start: '10:00', end: '22:00' },
];

export default function FixedShiftsPage() {
    const [shifts, setShifts] = useState<RecurringShift[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState<number | null>(null);

    // Simulation Context
    const [simYear, setSimYear] = useState(2025);
    const [simWeek, setSimWeek] = useState(42);

    useEffect(() => {
        // Load Persistence for Simulation
        const savedWeek = localStorage.getItem('calendar_week');
        const savedYear = localStorage.getItem('calendar_year');
        if (savedWeek) setSimWeek(parseInt(savedWeek));
        if (savedYear) setSimYear(parseInt(savedYear));
    }, []);

    const [newShift, setNewShift] = useState<NewShift>({
        staffId: 0,
        daysOfWeek: [],
        start_time: '00:00',
        end_time: '00:00',
        postazione: '',
        shiftTemplateId: 0
    });

    const dayMap = [
        { id: 1, label: 'Lun' },
        { id: 2, label: 'Mar' },
        { id: 3, label: 'Mer' },
        { id: 4, label: 'Gio' },
        { id: 5, label: 'Ven' },
        { id: 6, label: 'Sab' },
        { id: 7, label: 'Dom' },
    ];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [s, st] = await Promise.all([
                api.getRecurringShifts(),
                fetch('/api/staff').then(r => r.json())
            ]);
            setShifts(s);
            setStaffList(st.sort((a: any, b: any) => (a.listIndex ?? 999) - (b.listIndex ?? 999)));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (shift: RecurringShift) => {
        setEditMode(shift.id);
        setNewShift({
            staffId: shift.staffId,
            daysOfWeek: [shift.dayOfWeek], // Edit mode usually handles single record
            start_time: shift.start_time,
            end_time: shift.end_time,
            postazione: shift.postazione || '',
            shiftTemplateId: 0,
            startWeek: shift.startWeek || undefined,
            endWeek: shift.endWeek || undefined,
            startYear: shift.startYear || undefined,
            endYear: shift.endYear || undefined,
        });
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setNewShift({ staffId: 0, daysOfWeek: [], start_time: '00:00', end_time: '00:00', postazione: '', shiftTemplateId: 0 });
    };

    const handleSave = async () => {
        if (!newShift.staffId || newShift.daysOfWeek.length === 0) {
            alert("Seleziona dipendente e i giorni/o");
            return;
        }

        try {
            if (editMode) {
                // Update specific record
                await api.updateRecurringShift(editMode, {
                    ...newShift,
                    dayOfWeek: newShift.daysOfWeek[0] // Assume single day for edit
                });
                alert("Turno aggiornato!");
            } else {
                // Create New
                await api.addRecurringShift(newShift);
                alert("Turni creati con successo!");
            }
            handleCancelEdit();
            loadData();
        } catch (error) {
            alert("Errore salvataggio: " + (error as any).message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Sei sicuro di voler eliminare questo turno fisso?")) return;
        try {
            await api.deleteRecurringShift(id);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Errore cancellazione");
        }
    };

    const toggleDay = (d: number) => {
        if (editMode) {
            // In edit mode, usually stick to one day or it gets complex (changing 1 record to N records?)
            // Let's allow switching the day of THIS record.
            setNewShift({ ...newShift, daysOfWeek: [d] });
            return;
        }

        const current = newShift.daysOfWeek;
        if (current.includes(d)) {
            setNewShift({ ...newShift, daysOfWeek: current.filter(x => x !== d) });
        } else {
            setNewShift({ ...newShift, daysOfWeek: [...current, d] });
        }
    };

    const toggleAllDays = () => {
        if (editMode) return; // Disable for edit
        if (newShift.daysOfWeek.length === 7) {
            setNewShift({ ...newShift, daysOfWeek: [] });
        } else {
            setNewShift({ ...newShift, daysOfWeek: [1, 2, 3, 4, 5, 6, 7] });
        }
    };

    const applyTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        const t = TEMPLATES.find(x => x.label === val);
        if (t && t.start) {
            setNewShift({ ...newShift, start_time: t.start, end_time: t.end });
        }
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-8 text-gray-800 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="text-blue-600" /> Gestione Turni Fissi
                </div>

                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded border border-indigo-100 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-indigo-800">Simulazione</span>
                    <input
                        type="number"
                        className="w-12 bg-white border-b border-indigo-200 text-sm font-bold text-center"
                        value={simYear}
                        onChange={e => setSimYear(Number(e.target.value))}
                    />
                    <span className="text-indigo-400">/</span>
                    <select
                        className="bg-transparent text-sm font-bold text-indigo-700 outline-none cursor-pointer"
                        value={simWeek}
                        onChange={e => setSimWeek(Number(e.target.value))}
                    >
                        {Array.from({ length: 53 }, (_, i) => i + 1).map(w => <option key={w} value={w}>W{w}</option>)}
                    </select>
                    <Link
                        href={`/requirements/details?year=${simYear}&week=${simWeek}`}
                        className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition shadow-sm"
                    >
                        <Repeat size={14} className="animate-pulse" />
                        Verifica Copertura
                    </Link>
                </div>
            </h1>

            <div className={`p-6 rounded-xl shadow-lg border border-gray-100 mb-8 transition-colors ${editMode ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${editMode ? 'text-orange-700' : 'text-gray-700'}`}>
                    {editMode ? <Pencil size={20} /> : <Plus size={20} className="text-emerald-500" />}
                    {editMode ? 'Modifica Turno Fisso' : 'Nuovo Turno Fisso'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-600 font-bold text-sm">Dipendente</span>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <select
                                className="w-full pl-10 p-2 border rounded shadow-sm focus:ring-2 focus:ring-blue-500 bg-white font-medium disabled:opacity-50"
                                value={newShift.staffId}
                                onChange={(e) => setNewShift({ ...newShift, staffId: Number(e.target.value) })}
                                disabled={!!editMode} // Usually don't change staff in edit, but could allow
                            >
                                <option value={0}>Seleziona...</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-gray-600 font-bold text-sm mb-1">Giorni</span>
                        <div className="flex flex-wrap gap-2">
                            {!editMode && (
                                <button
                                    onClick={toggleAllDays}
                                    className={`px-2 py-1 text-xs font-bold rounded border ${newShift.daysOfWeek.length === 7 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                >
                                    Tutti
                                </button>
                            )}
                            {dayMap.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => toggleDay(d.id)}
                                    className={`w-10 py-1 text-xs font-bold rounded border transition ${newShift.daysOfWeek.includes(d.id) ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                        {editMode && <span className="text-xs text-orange-600 mt-1">* In modifica puoi cambiare solo il giorno di questo specifico turno.</span>}
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-1 w-48">
                        <span className="text-gray-600 font-bold text-sm">Postazione</span>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <select
                                className="w-full pl-10 p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                                value={newShift.postazione}
                                onChange={(e) => setNewShift({ ...newShift, postazione: e.target.value })}
                            >
                                <option value="">Seleziona...</option>
                                {DEFAULT_STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 w-64">
                        <span className="text-gray-600 font-bold text-sm">Template</span>
                        <select onChange={applyTemplate} className="p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500 font-medium bg-white">
                            {TEMPLATES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-gray-500 text-xs font-bold">Inizio</span>
                            <input
                                type="time"
                                className="p-2 border rounded bg-white shadow-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newShift.start_time}
                                onChange={e => setNewShift({ ...newShift, start_time: e.target.value })}
                            />
                        </div>
                        <span className="text-gray-400 mt-5">-</span>
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-gray-500 text-xs font-bold">Fine</span>
                                <input
                                    type="time"
                                    className="p-2 border rounded bg-white shadow-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newShift.end_time}
                                    onChange={e => setNewShift({ ...newShift, end_time: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 w-20">
                            <span className="text-gray-500 text-xs font-bold">Dal Week</span>
                            <input
                                type="number"
                                min={1} max={53}
                                className="p-2 border rounded bg-white shadow-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newShift.startWeek || ''}
                                placeholder="-"
                                onChange={e => setNewShift({ ...newShift, startWeek: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                        <span className="text-gray-400 mt-5">/</span>
                        <div className="flex flex-col gap-1 w-20">
                            <span className="text-gray-500 text-xs font-bold">Al Week</span>
                            <input
                                type="number"
                                min={1} max={53}
                                className="p-2 border rounded bg-white shadow-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newShift.endWeek || ''}
                                placeholder="-"
                                onChange={e => setNewShift({ ...newShift, endWeek: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 border-l pl-2 border-gray-200">
                        <div className="flex flex-col gap-1 w-20">
                            <span className="text-gray-500 text-xs font-bold">Start Year</span>
                            <input
                                type="number"
                                className="p-2 border rounded bg-white shadow-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newShift.startYear || ''}
                                placeholder="-"
                                onChange={e => setNewShift({ ...newShift, startYear: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                        <div className="flex flex-col gap-1 w-20">
                            <span className="text-gray-500 text-xs font-bold">End Year</span>
                            <input
                                type="number"
                                className="p-2 border rounded bg-white shadow-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={newShift.endYear || ''}
                                placeholder="-"
                                onChange={e => setNewShift({ ...newShift, endYear: e.target.value ? Number(e.target.value) : undefined })}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        {editMode && (
                            <button onClick={handleCancelEdit} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold shadow-sm transition h-[42px]">
                                <X size={20} /> Annulla
                            </button>
                        )}
                        <button onClick={handleSave} className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg font-bold shadow-md transition h-[42px] ${editMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                            {editMode ? <Save size={20} /> : <Plus size={20} />}
                            {editMode ? 'Salva Modifiche' : 'Aggiungi Turni'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                            <th className="p-4 border-b">Dipendente</th>
                            <th className="p-4 border-b">Giorno</th>
                            <th className="p-4 border-b">Orario / Template</th>
                            <th className="p-4 border-b">Postazione</th>
                            <th className="p-4 border-b text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {shifts.map(shift => (
                            <tr key={shift.id} className={`hover:bg-gray-50 transition items-center ${editMode === shift.id ? 'bg-orange-50' : ''}`}>
                                <td className="p-4 font-bold text-gray-700 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                        <User size={14} />
                                    </div>
                                    <div>
                                        {shift.staff?.nome} {shift.staff?.cognome}
                                    </div>
                                </td>
                                <td className="p-4 text-gray-600">
                                    <span className="inline-block px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                                        {dayMap.find(d => d.id === shift.dayOfWeek)?.label || '-'}
                                    </span>
                                </td>
                                <td className="p-4 font-mono text-xs text-gray-600">
                                    <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                        {shift.start_time} - {shift.end_time}
                                    </span>
                                    {(shift.startWeek || shift.endWeek) && (
                                        <div className="mt-1 text-[10px] text-purple-600 font-bold">
                                            W{shift.startWeek || 1} - W{shift.endWeek || 53}
                                            {(shift.startYear || shift.endYear) && <span className="ml-1 text-gray-500">{shift.startYear || ''}-{shift.endYear || ''}</span>}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-gray-600 font-medium">
                                    {shift.postazione || '-'}
                                </td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button onClick={() => handleEdit(shift)} className="text-blue-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition" title="Modifica">
                                        <Pencil size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(shift.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition" title="Elimina">
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
