
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

    const [staffSearch, setStaffSearch] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

    const filteredStaff = React.useMemo(() => {
        if (!staffSearch) return [];
        return staffList.filter(s => {
            const fullName = `${s.nome || ''} ${s.cognome || ''}`.toLowerCase();
            return fullName.includes(staffSearch.toLowerCase());
        });
    }, [staffList, staffSearch]);

    // Reset focus when search changes
    useEffect(() => {
        setFocusedIndex(-1);
    }, [staffSearch]);

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
        setStaffSearch(`${shift.staff.nome} ${shift.staff.cognome}`);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setNewShift({ staffId: 0, daysOfWeek: [], start_time: '00:00', end_time: '00:00', postazione: '', shiftTemplateId: 0 });
        setStaffSearch('');
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
                            <User className="absolute left-3 top-2.5 text-gray-400 z-10" size={18} />
                            <input
                                type="text"
                                className="w-full pl-10 p-2 border rounded shadow-sm focus:ring-2 focus:ring-blue-500 bg-white font-medium disabled:opacity-50"
                                placeholder="Cerca dipendente..."
                                value={staffSearch}
                                onChange={(e) => {
                                    setStaffSearch(e.target.value);
                                    setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                onBlur={() => {
                                    // Delay to allow click event to fire
                                    setTimeout(() => setIsDropdownOpen(false), 200);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setIsDropdownOpen(true);
                                        setFocusedIndex(prev => (prev + 1) % filteredStaff.length);
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setIsDropdownOpen(true);
                                        setFocusedIndex(prev => (prev - 1 + filteredStaff.length) % filteredStaff.length);
                                    } else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (focusedIndex >= 0 && filteredStaff[focusedIndex]) {
                                            const selected = filteredStaff[focusedIndex];
                                            setNewShift({ ...newShift, staffId: selected.id });
                                            setStaffSearch(`${selected.nome} ${selected.cognome}`);
                                            setFocusedIndex(-1);
                                            setIsDropdownOpen(false);
                                        } else if (filteredStaff.length > 0) {
                                            const selected = filteredStaff[0];
                                            setNewShift({ ...newShift, staffId: selected.id });
                                            setStaffSearch(`${selected.nome} ${selected.cognome}`);
                                            setIsDropdownOpen(false);
                                        }
                                    } else if (e.key === 'Escape') {
                                        setIsDropdownOpen(false);
                                        setFocusedIndex(-1);
                                    }
                                }}
                                disabled={!!editMode}
                            />
                        </div>
                        {isDropdownOpen && staffSearch && filteredStaff.length > 0 && (
                            <div className="mt-1 max-h-48 overflow-y-auto border rounded shadow-lg bg-white absolute z-[100] w-full max-w-sm">
                                {filteredStaff.map((s, index) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        className={`w-full text-left px-4 py-2 hover:bg-blue-50 transition flex items-center gap-2 ${index === focusedIndex ? 'bg-blue-100 ring-2 ring-inset ring-blue-300' : ''}`}
                                        onClick={() => {
                                            setNewShift({ ...newShift, staffId: s.id });
                                            setStaffSearch(`${s.nome} ${s.cognome}`);
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        <User size={14} className="text-gray-400" />
                                        <span className="font-medium">{s.nome} {s.cognome}</span>
                                    </button>
                                ))
                                }
                            </div>
                        )}
                        {isDropdownOpen && staffSearch && filteredStaff.length === 0 && (
                            <div className="mt-1 max-h-48 overflow-y-auto border rounded shadow-lg bg-white absolute z-50 w-full max-w-sm">
                                <div className="px-4 py-3 text-gray-500 text-sm italic">
                                    Nessun dipendente trovato
                                </div>
                            </div>
                        )}
                        {newShift.staffId > 0 && !staffSearch && (
                            <div className="text-sm text-gray-600 mt-1">
                                Selezionato: <strong>{staffList.find(s => s.id === newShift.staffId)?.nome} {staffList.find(s => s.id === newShift.staffId)?.cognome}</strong>
                            </div>
                        )}
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
                            <MapPin className="absolute left-3 top-2.5 text-gray-400 z-10" size={18} />
                            <input
                                type="text"
                                className="w-full pl-10 p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500 bg-white font-medium uppercase"
                                placeholder="Inserisci o cerca..."
                                value={newShift.postazione}
                                onChange={(e) => setNewShift({ ...newShift, postazione: e.target.value.toUpperCase() })}
                                list="stations-datalist"
                            />
                            <datalist id="stations-datalist">
                                {DEFAULT_STATIONS.map(s => <option key={s} value={s} />)}
                            </datalist>
                        </div>
                        <span className="text-xs text-gray-500 italic">Puoi digitare un nome personalizzato</span>
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
                </div>

                {/* Helper text for permanent shifts */}
                <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-blue-600 mt-0.5">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900">💡 Turno Permanente</p>
                        <p className="text-xs text-blue-700 mt-1">
                            Lascia vuoti i campi <strong>Dal Week / Al Week</strong> per creare un turno <strong>permanente</strong> che rimane attivo per sempre, senza scadenza.
                        </p>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2 ml-auto">
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

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 text-xs uppercase tracking-wider font-bold border-b-2 border-gray-200">
                            <th className="p-5 text-left">Dipendente</th>
                            <th className="p-5 text-center">Giorno</th>
                            <th className="p-5">Orario / Periodo</th>
                            <th className="p-5">Postazione</th>
                            <th className="p-5 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shifts.map((shift, index) => {
                            // Color-code days
                            const dayColors = {
                                1: 'bg-blue-100 text-blue-700 border-blue-200',    // Lun
                                2: 'bg-green-100 text-green-700 border-green-200', // Mar
                                3: 'bg-yellow-100 text-yellow-700 border-yellow-200', // Mer
                                4: 'bg-purple-100 text-purple-700 border-purple-200', // Gio
                                5: 'bg-pink-100 text-pink-700 border-pink-200',    // Ven
                                6: 'bg-orange-100 text-orange-700 border-orange-200', // Sab
                                7: 'bg-red-100 text-red-700 border-red-200'        // Dom
                            };
                            const dayColor = dayColors[shift.dayOfWeek as keyof typeof dayColors] || 'bg-gray-100 text-gray-700 border-gray-200';

                            return (
                                <tr
                                    key={shift.id}
                                    className={`
                                        border-b border-gray-100 
                                        hover:bg-blue-50 hover:shadow-sm
                                        transition-all duration-150
                                        ${editMode === shift.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}
                                        ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}
                                    `}
                                >
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center text-sm font-bold shadow-md">
                                                <User size={16} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">
                                                    {shift.staff?.nome} {shift.staff?.cognome}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5 text-center">
                                        <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border-2 font-bold text-sm min-w-[60px] shadow-sm ${dayColor}`}>
                                            {dayMap.find(d => d.id === shift.dayOfWeek)?.label || '-'}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-gray-400" />
                                                <span className="bg-gradient-to-r from-gray-100 to-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 font-mono text-sm font-semibold text-gray-700 shadow-sm">
                                                    {shift.start_time} - {shift.end_time}
                                                </span>
                                            </div>
                                            {(shift.startWeek || shift.endWeek) && (
                                                <div className="flex items-center gap-1.5 ml-5">
                                                    <Calendar size={12} className="text-purple-500" />
                                                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                                        W{shift.startWeek || 1} - W{shift.endWeek || 53}
                                                        {(shift.startYear || shift.endYear) && (
                                                            <span className="ml-1 text-gray-500">
                                                                ({shift.startYear || ''}-{shift.endYear || ''})
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {!shift.startWeek && !shift.endWeek && (
                                                <div className="flex items-center gap-1.5 ml-5">
                                                    <Repeat size={12} className="text-green-500" />
                                                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                                        Permanente
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className="inline-block bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-semibold text-sm border border-indigo-200 shadow-sm">
                                            {shift.postazione || '-'}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(shift)}
                                                className="p-2.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all shadow-sm hover:shadow-md border border-transparent hover:border-blue-200"
                                                title="Modifica"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(shift.id)}
                                                className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all shadow-sm hover:shadow-md border border-transparent hover:border-red-200"
                                                title="Elimina"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div >
    );
}
