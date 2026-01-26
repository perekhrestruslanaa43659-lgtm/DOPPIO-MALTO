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
    weeklyHours: Record<number, number>; // StaffID -> Total Hours in Week
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
    existingAssignments,
    weeklyHours
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
        // Use weekly accumulated hours passed from parent
        const totalHours = weeklyHours[s.id] || 0;

        // Check conflicts ONLY on the specific day
        const assignmentsOnDay = existingAssignments.filter(a => a.staffId === s.id && a.data === date);

        const hasConflict = assignmentsOnDay.some(a => {
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

    const getShiftDuration = () => {
        if (!orari.start || !orari.end) return 0;
        // Handle Excel errors or invalid formats
        if (orari.start.includes('#') || orari.end.includes('#')) return 0;

        const cleanStart = orari.start.trim().split(' ')[0];
        const cleanEnd = orari.end.trim().split(' ')[0];

        const [h1, m1] = cleanStart.split(':').map(Number);
        const [h2, m2] = cleanEnd.split(':').map(Number);

        if (isNaN(h1) || isNaN(h2)) return 0;

        let diff = (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60);
        if (diff < 0) diff += 24;
        return diff;
    };

    const handleAssign = () => {
        if (selectedStaffId) {
            const staffMember = staffWithHours.find(s => s.id === selectedStaffId);
            if (staffMember) {
                // Check for 11h Rule / Split Shift
                const otherAssignments = existingAssignments.filter(a =>
                    a.staffId === selectedStaffId &&
                    a.data === date &&
                    a.status !== false
                );
                if (otherAssignments.length > 0) {
                    const confirmDouble = window.confirm(
                        `⚠️ ATTENZIONE: DOPPIO TURNO RILEVATO\n\n` +
                        `${staffMember.nome} ha già ${otherAssignments.length} turno/i oggi.\n` +
                        `L'assegnazione di un turno di Pranzo e Cena nello stesso giorno riduce il riposo sotto le 11 ore.\n\n` +
                        `Confermi di voler procedere?`
                    );
                    if (!confirmDouble) return;
                }

                const duration = getShiftDuration();
                const newTotal = staffMember.assignedHours + duration;

                // Handle 0 as unlimited/on-call
                const contractHours = staffMember.oreMassime !== undefined && staffMember.oreMassime !== null ? staffMember.oreMassime : 40;
                const isUnlimited = contractHours === 0;
                const max = contractHours + 1;

                if (!isUnlimited && newTotal > max) {
                    const confirm = window.confirm(
                        `ATTENZIONE: Assegnando questo turno, ${staffMember.nome} supererà il limite contrattuale (+1h).\n\n` +
                        `Ore attuali: ${staffMember.assignedHours.toFixed(1)}\n` +
                        `Nuovo totale: ${newTotal.toFixed(1)}\n` +
                        `Limite (+1h): ${max}\n\n` +
                        `Vuoi procedere comunque?`
                    );
                    if (!confirm) return;
                }
            }
            onSelect(selectedStaffId);
            setSelectedStaffId(null);
        }
    };

    // Sort staff based on priority
    const sortedStaff = [...staffWithHours].sort((a, b) => {
        const typeScore: Record<string, number> = { 'TIROCINANTE': 3, 'STANDARD': 2, 'CHIAMATA': 1 };

        // Handle undefined contractType (default to STANDARD)
        const typeA = a.contractType || 'STANDARD';
        const typeB = b.contractType || 'STANDARD';

        const scoreA = typeScore[typeA] || 2;
        const scoreB = typeScore[typeB] || 2;

        if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first

        // If sorting Standard vs Standard, prioritize "NOT SATURATED"
        // Saturated = assigned >= Contract - 1
        if (scoreA === 2) {
            const contractA = a.oreMassime !== undefined && a.oreMassime !== null ? a.oreMassime : 40;
            const contractB = b.oreMassime !== undefined && b.oreMassime !== null ? b.oreMassime : 40;

            // Check saturation (using the "Contract - 1" rule)
            // If I have 39h (Contract 40), I am Saturated because 39 >= 39.
            // If I have 38h, I am NOT saturated.

            const limitA = contractA - 1;
            const limitB = contractB - 1;

            const isSaturatedA = a.assignedHours >= limitA;
            const isSaturatedB = b.assignedHours >= limitB;

            if (!isSaturatedA && isSaturatedB) return -1; // A first (needs hours)
            if (isSaturatedA && !isSaturatedB) return 1;  // B first
        }

        return 0;
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Assegna Staff</h2>
                        <p className="text-sm text-gray-600">
                            {postazione} • {dateFormatted} • {shiftLabel} ({orari.start} - {orari.end}) •
                            <span className="font-semibold ml-1 text-indigo-700">{getShiftDuration().toFixed(1)}h</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                {/* Staff List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {sortedStaff.map(s => {
                            const duration = getShiftDuration();
                            const projected = s.assignedHours + duration;

                            const contractHours = s.oreMassime !== undefined && s.oreMassime !== null ? s.oreMassime : 40;
                            const isUnlimited = contractHours === 0 || s.contractType === 'CHIAMATA'; // Force unlimited for Chiamata
                            const maxLimit = contractHours + 1;

                            const isOver = !isUnlimited && projected > maxLimit;

                            // Visuals & Residual Logic
                            const isTirocinante = s.contractType === 'TIROCINANTE';
                            const isChiamata = s.contractType === 'CHIAMATA';

                            let residueDisplay = "";
                            let residueColor = "";
                            let availabilityDisplay = "";

                            if (isUnlimited) {
                                // On-Call: Count up from 0
                                const val = projected;
                                residueDisplay = `+${val.toFixed(1)}h`;
                                residueColor = "text-amber-700 font-medium"; // Warning color for extra cost
                                availabilityDisplay = "Extra Cost";
                            } else {
                                // Fixed: Count up to 0 (Start at -Contract)
                                // Current Balance = Assigned - Contract
                                // Goal is 0.
                                const balance = projected - contractHours;
                                if (balance < 0) {
                                    residueDisplay = `${balance.toFixed(1)}h`;
                                    residueColor = "text-orange-600 font-medium";
                                    availabilityDisplay = "Sotto Contratto";
                                } else if (Math.abs(balance) < 0.1) {
                                    residueDisplay = "0.0h";
                                    residueColor = "text-green-600 font-bold";
                                    availabilityDisplay = "Target Raggiunto";
                                } else {
                                    residueDisplay = `+${balance.toFixed(1)}h`;
                                    residueColor = "text-red-600 font-bold";
                                    availabilityDisplay = "Straordinario";
                                }
                            }

                            return (
                                <div
                                    key={s.id}
                                    onClick={() => !s.hasConflict && setSelectedStaffId(s.id)}
                                    className={`p-3 border rounded-lg cursor-pointer transition relative overflow-hidden ${selectedStaffId === s.id
                                        ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600'
                                        : s.hasConflict
                                            ? 'border-red-300 bg-red-50 cursor-not-allowed opacity-60'
                                            : isOver
                                                ? 'border-orange-200 bg-orange-50 hover:bg-orange-100'
                                                : isTirocinante
                                                    ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100'
                                                    : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50'
                                        }`}
                                >
                                    {isTirocinante && <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-700 text-[9px] px-2 py-0.5 rounded-bl font-bold">€ LOW</div>}
                                    {isChiamata && <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-700 text-[9px] px-2 py-0.5 rounded-bl font-bold">A CHIAMATA</div>}

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOver ? 'bg-orange-100' : 'bg-indigo-100'}`}>
                                                <User size={20} className={isOver ? 'text-orange-600' : 'text-indigo-600'} />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-800">{s.nome} {s.cognome}</div>
                                                <div className="text-xs text-gray-500">
                                                    {s.ruolo}
                                                    {s.postazioni && s.postazioni.length > 0 && (
                                                        <span className="ml-2">• {s.postazioni.join(', ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm ${residueColor}`}>
                                                {residueDisplay}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {isUnlimited ? 'A Chiamata' : `/ ${contractHours}h`}
                                            </div>
                                            <div className={`text-[10px] uppercase tracking-wider font-bold ${isOver ? 'text-red-600' : residueColor}`}>
                                                {isOver ? 'LIMIT (+1h)' : availabilityDisplay}
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
                            );
                        })}
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
