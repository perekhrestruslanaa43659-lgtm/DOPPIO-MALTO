'use client';

import React, { useState, useEffect } from 'react';
import { X, User, AlertCircle, Trash2, Clock } from 'lucide-react';
import { canStaffWorkStation } from '@/lib/constants';

interface StaffSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (staffId: number, times?: { start: string, end: string }) => void;
    onDelete?: () => void; // New prop for deletion
    date: string;
    postazione: string;
    shift: 'lunch' | 'dinner';
    orari: { start: string; end: string };
    staff: any[];
    existingAssignments: any[];
    weeklyHours: Record<number, number>; // StaffID -> Total Hours in Week
    currentStaffId?: number; // Should be passed if editing
}

export default function StaffSelectionModal({
    isOpen,
    onClose,
    onSelect,
    onDelete,
    date,
    postazione,
    shift,
    orari,
    staff,
    existingAssignments,
    weeklyHours,
    currentStaffId
}: StaffSelectionModalProps) {
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(currentStaffId || null);

    // State for local time editing
    const [localStart, setLocalStart] = useState(orari.start);
    const [localEnd, setLocalEnd] = useState(orari.end);

    useEffect(() => {
        setSelectedStaffId(currentStaffId || null);
    }, [currentStaffId, isOpen]);

    useEffect(() => {
        setLocalStart(orari.start);
        setLocalEnd(orari.end);
    }, [orari, isOpen]);

    // Handle Enter key to save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && selectedStaffId) {
                e.preventDefault();
                handleAssign();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, selectedStaffId, localStart, localEnd]);

    if (!isOpen) return null;

    const shiftLabel = shift === 'lunch' ? 'Pranzo' : 'Cena';
    const dateFormatted = new Date(date).toLocaleDateString('it-IT', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });

    const getShiftDuration = () => {
        if (!localStart || !localEnd) return 0;
        // Handle Excel errors or invalid formats
        if (localStart.includes('#') || localEnd.includes('#')) return 0;

        const cleanStart = localStart.trim().split(' ')[0];
        const cleanEnd = localEnd.trim().split(' ')[0];

        const [h1, m1] = cleanStart.split(':').map(Number);
        const [h2, m2] = cleanEnd.split(':').map(Number);

        if (isNaN(h1) || isNaN(h2)) return 0;

        let diff = (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60);
        if (diff < 0) diff += 24;
        return diff;
    };

    // Normalize station name (same logic as scheduler)
    const normalize = (s: string) => {
        let norm = s.toLowerCase();
        // Handle accents
        norm = norm.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        norm = norm.replace(/_[0-9]+$/, '');
        norm = norm.replace(/_(s|v|d|l|m|me|g)$/, '');
        norm = norm.replace(/:[a-z0-9]+$/, '');
        norm = norm.replace(/\s[0-9]+$/, '');
        norm = norm.replace(/\s[a-z]$/, '');
        return norm.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '');
    };

    const postazioneNorm = normalize(postazione);

    // Filter staff: only show those who have this station AND department compatibility
    const eligibleStaff = staff.filter(s => {
        // Parse postazioni (handle JSON or comma-separated)
        let staffPostazioni: string[] = [];
        try {
            if (typeof s.postazioni === 'string') {
                if (s.postazioni.trim().startsWith('[')) {
                    staffPostazioni = JSON.parse(s.postazioni);
                } else if (s.postazioni.trim()) {
                    staffPostazioni = s.postazioni.split(',').map((p: string) => p.trim()).filter((p: string) => p);
                }
            } else if (Array.isArray(s.postazioni)) {
                staffPostazioni = s.postazioni;
            }
        } catch (error) {
            console.error(`Error parsing postazioni for staff ${s.id}:`, error);
            return false;
        }

        // Check if staff has this station (normalized match)
        const hasStation = staffPostazioni.some(p => normalize(p) === postazioneNorm);
        if (!hasStation) return false;

        // Check department compatibility (SALA vs CUCINA)
        const canWork = canStaffWorkStation(staffPostazioni, postazione);
        return canWork;
    });

    // Calculate hours for each eligible staff member
    const staffWithHours = eligibleStaff.map(s => {
        // Use weekly accumulated hours passed from parent
        const totalHours = weeklyHours[s.id] || 0;

        // Check conflicts ONLY on the specific day
        const assignmentsOnDay = existingAssignments.filter(a => a.staffId === s.id && a.data === date);

        const hasConflict = assignmentsOnDay.some(a => {
            // Exclude the current assignment if we are editing it
            if (currentStaffId === s.id && a.staffId === currentStaffId) {
                // This is a simplified check. A more robust solution would compare the full assignment object.
                // For now, if currentStaffId is present, we assume we are editing *that* assignment,
                // so it shouldn't conflict with itself.
                return false;
            }

            const start = a.start_time || a.shiftTemplate?.oraInizio;
            const end = a.end_time || a.shiftTemplate?.oraFine;
            if (!start || !end) return false;

            // Check if times overlap
            return (start < localEnd && end > localStart);
        });

        return {
            ...s,
            assignedHours: totalHours,
            availableHours: (s.oreMassime || 40) - totalHours,
            hasConflict
        };
    });

    const handleAssign = () => {
        console.log('🎯 StaffSelectionModal: handleAssign called');
        console.log('   Selected Staff ID:', selectedStaffId);

        if (selectedStaffId) {
            const staffMember = staffWithHours.find(s => s.id === selectedStaffId);
            console.log('   Staff Member:', staffMember);

            if (staffMember) {
                // 1. Check if STATION is already taken by someone else
                // (Only warn, don't block 100% because maybe they want 2 people, but usually it's a mistake)
                const stationOccupiedBy = existingAssignments.find(a =>
                    a.postazione === postazione &&
                    a.data === date &&
                    a.staffId !== selectedStaffId && // Not self (coverage)
                    a.staffId !== currentStaffId && // Not the one we are editing (if swapping)
                    a.status !== false &&
                    // Check time overlap or just same "Shift" (Pranzo/Cena). 
                    // The modal knows 'shift' ('lunch'|'dinner') but that's loose.
                    // Better to check time overlap with 'localStart'/'localEnd'
                    (
                        (a.start_time || a.shiftTemplate?.oraInizio) < localEnd &&
                        (a.end_time || a.shiftTemplate?.oraFine) > localStart
                    )
                );

                if (stationOccupiedBy) {
                    // Find staff name
                    const occupier = staff.find(s => s.id === stationOccupiedBy.staffId);
                    const occupierName = occupier ? `${occupier.nome} ${occupier.cognome}` : 'un altro dipendente';

                    const confirmStation = window.confirm(
                        `⚠️ ATTENZIONE: POSTAZIONE OCCUPATA\n\n` +
                        `La postazione "${postazione}" è già assegnata a ${occupierName} in questo orario.\n\n` +
                        `Vuoi assegnarla comunque (doppia copertura)?`
                    );
                    if (!confirmStation) {
                        return;
                    }
                }

                // Check for 11h Rule / Split Shift
                const otherAssignments = existingAssignments.filter(a => {
                    // Check if this assignment belongs to the selected staff on this date
                    const isForSelectedStaff = (
                        a.staffId === selectedStaffId &&
                        a.data === date &&
                        a.status !== false
                    );

                    if (!isForSelectedStaff) return false;

                    // If we are editing (currentStaffId is set) AND the selected staff IS the current staff,
                    // we assume we are editing THIS assignment.
                    // Since we enforce 1 shift per day, any existing assignment for this staff on this day
                    // IS the one we are editing, so we exclude it.
                    if (currentStaffId && selectedStaffId === currentStaffId) {
                        return false;
                    }

                    // If we are selecting a DIFFERENT staff member (e.g. swapping/reassigning),
                    // then their existing assignment IS a conflict.
                    return true;
                });
                if (otherAssignments.length > 0) {
                    alert(
                        `⛔ VIETATO: DOPPIO TURNO\n\n` +
                        `${staffMember.nome} ha già un turno oggi.\n` +
                        `Non è consentito assegnare Pranzo e Cena allo stesso dipendente nella stessa giornata.`
                    );
                    return; // Strictly block
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
                    if (!confirm) {
                        console.log('   User cancelled contract limit override');
                        return;
                    }
                }
            }
            console.log('✅ Calling onSelect with staffId:', selectedStaffId);
            onSelect(selectedStaffId, { start: localStart, end: localEnd });
            setSelectedStaffId(null);
        } else {
            console.warn('⚠️ No staff selected');
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
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 outline-none"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col outline-none"
                onClick={(e) => e.stopPropagation()}
                tabIndex={-1}
            >
                {/* Header */}
                <div className="p-4 border-b bg-indigo-50 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">
                            {currentStaffId ? 'Modifica Turno' : 'Assegna Staff'}
                        </h2>
                        <p className="text-sm text-gray-600">
                            {postazione} • {dateFormatted} • {shiftLabel}
                            <span className="font-semibold ml-2 text-indigo-700">{getShiftDuration().toFixed(1)}h</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                {/* Settings / Times */}
                <div className="px-4 py-3 bg-white border-b flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Orario:</span>
                        <input
                            type="time"
                            value={localStart}
                            onChange={(e) => setLocalStart(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span className="text-gray-400 font-bold">-</span>
                        <input
                            type="time"
                            value={localEnd}
                            onChange={(e) => setLocalEnd(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                {/* Staff List */}
                <div className="flex-1 overflow-y-auto p-4 content-start">
                    {sortedStaff.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                            <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                Nessuno staff disponibile
                            </h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Non ci sono dipendenti con la postazione <strong>"{postazione}"</strong> nelle loro competenze
                                o non hanno il dipartimento compatibile (SALA/CUCINA).
                            </p>
                            <p className="text-xs text-gray-400 mt-4">
                                Aggiungi questa postazione alle competenze dello staff nella pagina Personale.
                            </p>
                        </div>
                    ) : (
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

                                const isSelected = selectedStaffId === s.id;

                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => !s.hasConflict && setSelectedStaffId(s.id)}
                                        className={`p-3 border rounded-lg cursor-pointer transition relative overflow-hidden ${isSelected
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

                                        {/* Show existing assignments for this day */}
                                        {(() => {
                                            const dayAssignments = existingAssignments.filter(a => a.staffId === s.id && a.data === date);
                                            // Don't show the assignment being edited if it matches
                                            // But for now, simple list is fine
                                            if (dayAssignments.length === 0) return null;

                                            return (
                                                <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-1.5 rounded border border-gray-100">
                                                    <span className="font-semibold text-gray-600">Turni oggi:</span>
                                                    <ul className="list-disc list-inside ml-1">
                                                        {dayAssignments.map((a, idx) => {
                                                            // Calculate times if available
                                                            const start = a.start_time || a.shiftTemplate?.oraInizio || '??:??';
                                                            const end = a.end_time || a.shiftTemplate?.oraFine || '??:??';
                                                            return (
                                                                <li key={idx}>
                                                                    {start} - {end} <span className="text-gray-400">({a.postazione})</span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
                    <div>
                        {/* Show Delete Button only if Editing (implied by currentStaffId existence or parent prop,
                            but parent can always pass onDelete if they want to allow delete) */}
                        {onDelete && (
                            <button
                                onClick={() => { if (confirm('Eliminare definitivamente questo turno?')) onDelete(); }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded flex items-center gap-2 transition"
                                title="Elimina Turno"
                            >
                                <Trash2 size={20} />
                                <span className="text-sm font-medium">Elimina</span>
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
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
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            {currentStaffId ? 'Salva Modifiche' : 'Assegna'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
