'use client';

import React, { useState, useEffect } from 'react';
import { X, User, AlertCircle } from 'lucide-react';

interface StaffSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (staffId: number) => void;
    date: string;
    postazione: string;
    shift: 'lunch' | 'dinner';
    orari: { start: string; end: string };
    staff: any[];
    existingAssignments: any[];
}

export default function StaffSelectionModal({
    isOpen,
    onClose,
    onSelect,
    date,
    postazione,
    shift,
    orari,
    staff,
    existingAssignments
}: StaffSelectionModalProps) {
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

    if (!isOpen) return null;

    const shiftLabel = shift === 'lunch' ? 'Pranzo' : 'Cena';
    const dateFormatted = new Date(date).toLocaleDateString('it-IT', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });

    // Calculate hours for each staff member
    const staffWithHours = staff.map(s => {
        const assignments = existingAssignments.filter(a => a.staffId === s.id && a.data === date);
        const totalHours = assignments.reduce((sum, a) => {
            const start = a.start_time || a.shiftTemplate?.oraInizio;
            const end = a.end_time || a.shiftTemplate?.oraFine;
            if (!start || !end) return sum;

            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            let diff = (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60);
            if (diff < 0) diff += 24;
            return sum + diff;
        }, 0);

        const hasConflict = assignments.some(a => {
            const start = a.start_time || a.shiftTemplate?.oraInizio;
            const end = a.end_time || a.shiftTemplate?.oraFine;
            if (!start || !end) return false;

            // Check if times overlap
            return (start < orari.end && end > orari.start);
        });

        return {
            ...s,
            assignedHours: totalHours,
            availableHours: (s.oreMassime || 40) - totalHours,
            hasConflict
        };
    });

    const handleAssign = () => {
        if (selectedStaffId) {
            onSelect(selectedStaffId);
            setSelectedStaffId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Assegna Staff</h2>
                        <p className="text-sm text-gray-600">
                            {postazione} • {dateFormatted} • {shiftLabel} ({orari.start} - {orari.end})
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                {/* Staff List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {staffWithHours.map(s => (
                            <div
                                key={s.id}
                                onClick={() => !s.hasConflict && setSelectedStaffId(s.id)}
                                className={`p-3 border rounded-lg cursor-pointer transition ${selectedStaffId === s.id
                                        ? 'border-indigo-600 bg-indigo-50'
                                        : s.hasConflict
                                            ? 'border-red-300 bg-red-50 cursor-not-allowed opacity-60'
                                            : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                                            <User size={20} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-800">{s.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {s.role === 'MANAGER' ? 'Manager' : 'Dipendente'}
                                                {s.postazioni && s.postazioni.length > 0 && (
                                                    <span className="ml-2">• {s.postazioni.join(', ')}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-gray-700">
                                            {s.assignedHours.toFixed(1)}h / {s.oreMassime || 40}h
                                        </div>
                                        <div className={`text-xs ${s.availableHours < 2 ? 'text-red-600' : 'text-green-600'
                                            }`}>
                                            {s.availableHours.toFixed(1)}h disponibili
                                        </div>
                                    </div>
                                </div>
                                {s.hasConflict && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
                                        <AlertCircle size={14} />
                                        <span>Conflitto orario con altro turno</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition text-sm font-medium"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedStaffId}
                        className={`px-4 py-2 rounded-lg transition text-sm font-medium ${selectedStaffId
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Assegna
                    </button>
                </div>
            </div>
        </div>
    );
}
