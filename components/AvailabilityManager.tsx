'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, Calendar, Clock } from 'lucide-react';

interface AvailabilityManagerProps {
    staffId: number;
    staffName: string;
    onClose: () => void;
}

export default function AvailabilityManager({ staffId, staffName, onClose }: AvailabilityManagerProps) {
    const [availabilities, setAvailabilities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedDays, setSelectedDays] = useState<number[]>([]); // Multi-select state
    const daysShort = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

    const [form, setForm] = useState({
        startTime: '09:00',
        endTime: '17:00'
    });

    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

    useEffect(() => {
        loadData();
    }, [staffId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getAvailability(staffId);
            setAvailabilities(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleDay = (index: number) => {
        if (selectedDays.includes(index)) {
            setSelectedDays(selectedDays.filter(d => d !== index));
        } else {
            setSelectedDays([...selectedDays, index]);
        }
    };

    const handleAdd = async () => {
        if (selectedDays.length === 0) {
            alert("Seleziona almeno un giorno.");
            return;
        }

        try {
            setLoading(true);
            const startStr = form.startTime;
            const endStr = form.endTime;

            const promises = selectedDays.map(d => api.addAvailability({
                staffId,
                dayOfWeek: d,
                startTime: startStr,
                endTime: endStr
            }));

            await Promise.all(promises);
            await loadData();
            // Optional: clear selection or keep it? 
            // Better to keep it for rapid entry of same time on other days, but specific instructions say "simplify insertion".
            // Let's keep selection but maybe feedback success.
        } catch (e: any) {
            alert('Errore aggiunta: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        // ... (existing delete logic)
        if (!confirm('Eliminare disponibilità?')) return;
        try {
            await api.deleteAvailability(id);
            await loadData();
        } catch (e: any) {
            alert('Errore eliminazione: ' + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Calendar className="text-indigo-600" />
                        Disponibilità: {staffName}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        Chiudi
                    </button>
                </div>

                {/* Add Form */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-100">
                    <div className="text-sm font-semibold mb-2 text-gray-700">Aggiungi Fascia Ricorrente</div>

                    {/* Day Selection Chips */}
                    <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                        {days.map((d, i) => {
                            const isSelected = selectedDays.includes(i);
                            return (
                                <button
                                    key={i}
                                    onClick={() => toggleDay(i)}
                                    className={`px-2 py-1 rounded text-xs font-bold transition border ${isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    {daysShort[i]}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setSelectedDays([1, 2, 3, 4, 5, 6, 0])}
                            className="px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 ml-auto"
                        >
                            Tutti
                        </button>
                    </div>

                    <div className="flex gap-2 mb-2 items-center">
                        <div className="text-xs font-bold text-gray-400 mr-2">ORARIO:</div>
                        <input
                            type="time"
                            className="w-24 p-2 border rounded text-sm"
                            value={form.startTime}
                            onChange={e => setForm({ ...form, startTime: e.target.value })}
                        />
                        <span className="self-center font-bold text-gray-400">-</span>
                        <input
                            type="time"
                            className="w-24 p-2 border rounded text-sm"
                            value={form.endTime}
                            onChange={e => setForm({ ...form, endTime: e.target.value })}
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={loading || selectedDays.length === 0}
                        className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Salvataggio...' : <><Plus size={16} /> Aggiungi ai giorni selezionati ({selectedDays.length})</>}
                    </button>
                </div>

                {/* List */}
                <div className="max-h-[300px] overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-4 text-gray-500">Caricamento...</div>
                    ) : availabilities.length === 0 ? (
                        <div className="text-center py-4 text-gray-400 text-sm">Nessuna disponibilità inserita.</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    <th className="p-2">Giorno</th>
                                    <th className="p-2">Orario</th>
                                    <th className="p-2 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {availabilities.map((a: any) => (
                                    <tr key={a.id}>
                                        <td className="p-2 font-medium text-gray-800">
                                            {a.dayOfWeek !== null ? days[a.dayOfWeek] : a.date}
                                        </td>
                                        <td className="p-2 text-gray-600">
                                            {a.startTime} - {a.endTime}
                                        </td>
                                        <td className="p-2 text-right">
                                            <button
                                                onClick={() => handleDelete(a.id)}
                                                className="text-red-400 hover:text-red-600 p-1"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-medium text-sm"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
}
