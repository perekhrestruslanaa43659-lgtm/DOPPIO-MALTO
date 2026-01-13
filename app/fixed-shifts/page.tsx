
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import QuarterTimeInput from '@/components/QuarterTimeInput';
import { CalendarClock, Trash2, Plus, RefreshCw, User } from 'lucide-react';

interface Staff {
    id: number;
    nome: string;
    cognome: string;
}

interface ShiftTemplate {
    id: number;
    nome: string;
    oraInizio: string;
    oraFine: string;
}

interface RecurringShift {
    id: number;
    staffId: number;
    dayOfWeek: number;
    shiftTemplateId: number | null;
    start_time: string | null;
    end_time: string | null;
    postazione: string | null;
    staff: Staff;
    shiftTemplate?: ShiftTemplate;
}

export default function FixedShiftsPage() {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [recurringShifts, setRecurringShifts] = useState<RecurringShift[]>([]);
    const [loading, setLoading] = useState(true);

    const days = [
        { label: 'Lunedì', value: 1 },
        { label: 'Martedì', value: 2 },
        { label: 'Mercoledì', value: 3 },
        { label: 'Giovedì', value: 4 },
        { label: 'Venerdì', value: 5 },
        { label: 'Sabato', value: 6 },
        { label: 'Domenica', value: 0 }
    ];

    const [form, setForm] = useState({
        staffId: '',
        dayOfWeek: 1,
        shiftTemplateId: '',
        start_time: '',
        end_time: '',
        postazione: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [s, t, r] = await Promise.all([
                api.getStaff(),
                api.getShiftTemplates(),
                api.getRecurringShifts()
            ]);
            setStaff(s as Staff[]);
            setTemplates(t as ShiftTemplate[]);
            setRecurringShifts(r as RecurringShift[]);
        } catch (e: any) {
            alert("Errore caricamento: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Rimuovere questo turno fisso?")) return;
        try {
            await api.deleteRecurringShift(id);
            setRecurringShifts(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            alert("Errore eliminazione: " + e.message);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.addRecurringShift({
                staffId: Number(form.staffId),
                dayOfWeek: Number(form.dayOfWeek),
                shiftTemplateId: form.shiftTemplateId ? Number(form.shiftTemplateId) : null,
                start_time: form.start_time || null,
                end_time: form.end_time || null,
                postazione: form.postazione || null
            });
            alert("✅ Turno fisso aggiunto!");
            setForm({ ...form, start_time: '', end_time: '', postazione: '' });
            loadData();
        } catch (e: any) {
            alert("Errore aggiunta: " + e.message);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-8 rounded-2xl shadow-xl text-white mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <CalendarClock className="w-8 h-8" />
                            Turni Fissi (Ricorrenti)
                        </h1>
                        <p className="opacity-90 mt-2">
                            Configura i turni che si ripetono automaticamente ogni settimana.
                        </p>
                    </div>
                    <button onClick={loadData} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition backdrop-blur-sm">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-teal-600" />
                    Nuovo Turno Fisso
                </h2>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dipendente</label>
                        <select
                            required
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                            value={form.staffId}
                            onChange={e => setForm({ ...form, staffId: e.target.value })}
                        >
                            <option value="">Seleziona...</option>
                            {staff.map(s => <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Giorno</label>
                        <select
                            required
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                            value={form.dayOfWeek}
                            onChange={e => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                        >
                            {days.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                        <select
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                            value={form.shiftTemplateId}
                            onChange={e => setForm({ ...form, shiftTemplateId: e.target.value })}
                        >
                            <option value="">Manuale (Personalizzato)</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.oraInizio}-{t.oraFine})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Postazione</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                            placeholder="Es. BAR"
                            value={form.postazione}
                            onChange={e => setForm({ ...form, postazione: e.target.value })}
                        />
                    </div>
                    {!form.shiftTemplateId && (
                        <div className="lg:col-span-2 flex gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <QuarterTimeInput label="Inizio" value={form.start_time} onChange={v => setForm({ ...form, start_time: v })} />
                            <QuarterTimeInput label="Fine" value={form.end_time} onChange={v => setForm({ ...form, end_time: v })} />
                        </div>
                    )}
                    <div className="lg:col-span-4 flex justify-end mt-2">
                        <button type="submit" className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 transition font-medium flex items-center gap-2">
                            <Plus size={18} /> Aggiungi Turno
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dipendente</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Giorno</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orario / Template</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Postazione</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {recurringShifts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400">Nessun turno fisso configurato.</td>
                            </tr>
                        )}
                        {recurringShifts.map(r => {
                            const dayLabel = days.find(d => d.value === r.dayOfWeek)?.label || r.dayOfWeek;
                            return (
                                <tr key={r.id} className="hover:bg-gray-50 transition">
                                    <td className="p-4 font-medium text-gray-900 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                                            <User size={14} />
                                        </div>
                                        {r.staff?.nome} {r.staff?.cognome}
                                    </td>
                                    <td className="p-4 text-gray-600">{dayLabel}</td>
                                    <td className="p-4">
                                        {r.shiftTemplate ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {r.shiftTemplate.nome} ({r.shiftTemplate.oraInizio}-{r.shiftTemplate.oraFine})
                                            </span>
                                        ) : (
                                            <span className="text-gray-600 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                                {r.start_time || '-'} - {r.end_time || '-'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-gray-600">{r.postazione || '-'}</td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleDelete(r.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="Rimuovi"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
