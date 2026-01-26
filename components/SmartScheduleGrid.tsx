
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { Copy, AlertTriangle } from 'lucide-react';

interface Assignment {
    id: number;
    staffId: number;
    data: string;
    start_time: string | null;
    end_time: string | null;
    postazione: string;
    status: boolean;
    shiftTemplate?: any;
}

interface SmartScheduleGridProps {
    staff: any[];
    days: string[];
    matrix: Record<number, Record<string, Assignment[]>>;
    onUpdateAssignment: (id: number, updates: any) => Promise<void>;
    onCreateAssignment: (data: any) => Promise<void>;
    onDeleteAssignment: (id: number) => Promise<void>;
}

export default function SmartScheduleGrid({
    staff,
    days,
    matrix,
    onUpdateAssignment,
    onCreateAssignment,
    onDeleteAssignment
}: SmartScheduleGridProps) {
    const [editingCell, setEditingCell] = useState<{ staffId: number, date: string, type: 'PRANZO' | 'SERA' } | null>(null);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // Format: "staffId|date|type"
    const [clipboard, setClipboard] = useState<{ start: string, end: string, postazione: string } | null>(null);

    // Focus input when editing starts
    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingCell]);

    // Helper to get assignment for specific cell
    const getShift = (staffId: number, date: string, type: 'PRANZO' | 'SERA') => {
        const list = matrix[staffId]?.[date] || [];
        return list.find(a => {
            const sT = a.start_time || a.shiftTemplate?.oraInizio;
            if (!sT) return false;
            const h = parseInt(sT.split(':')[0]);
            return type === 'PRANZO' ? h < 17 : h >= 17;
        });
    };

    // Parse "9-17" or "FER" etc.
    const parseInput = (text: string) => {
        const upper = text.toUpperCase().trim();

        // HR Codes
        if (['FER', 'MAL', 'ROL', 'PNR'].includes(upper)) {
            return { type: 'HR', code: upper };
        }

        // Task codes (simple heuristic: > 2 chars, letters)
        if (/^[A-Z]{2,}$/.test(upper) && !upper.includes(':') && !upper.includes('-')) {
            return { type: 'TASK', code: upper };
        }

        // Time Range
        // Normalize: replace dots/commas with colon, remove spaces around separators
        let clean = text.trim().replace(/[.,]/g, ':').replace(/\s*-\s*/, '-').replace(/\s+/, '-');
        const parts = clean.split('-');

        if (parts.length === 2) {
            const pad = (n: string) => {
                if (!n) return '';
                if (n.includes(':')) {
                    const [h, m] = n.split(':');
                    return `${h.padStart(2, '0')}:${m.padEnd(2, '0')}`;
                }
                return `${n.padStart(2, '0')}:00`;
            };
            const start = pad(parts[0]);
            const end = pad(parts[1]);
            // Basic regex
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (timeRegex.test(start) && timeRegex.test(end)) {
                return { type: 'TIME', start, end };
            }
        }

        return null;
    };

    const handleCellClick = (staffId: number, date: string, type: 'PRANZO' | 'SERA', currentAsn?: Assignment) => {
        setEditingCell({ staffId, date, type });
        if (currentAsn) {
            // Pre-fill input
            const s = currentAsn.start_time || '';
            const e = currentAsn.end_time || '';
            const p = currentAsn.postazione;

            // If it's a justification (fake postazione), show that
            if (['FERIE', 'MALATTIA', 'PERMESSO'].includes(p)) {
                setInputValue(p.substring(0, 3)); // FER, MAL
            } else if (s && e) {
                // Format nicely: 09:00 -> 9
                const fmt = (t: string) => t.startsWith('0') ? t.substring(1, 5) : t.substring(0, 5);
                setInputValue(`${fmt(s)}-${fmt(e)}`);
            } else {
                setInputValue('');
            }
        } else {
            setInputValue('');
        }
    };

    const commitEdit = async () => {
        if (!editingCell) return;
        const { staffId, date, type } = editingCell;
        const currentAsn = getShift(staffId, date, type);

        const parsed = parseInput(inputValue);

        try {
            if (!inputValue) {
                // Delete if empty
                if (currentAsn) await onDeleteAssignment(currentAsn.id);
            } else if (parsed?.type === 'TIME') {
                if (currentAsn) {
                    await onUpdateAssignment(currentAsn.id, { start_time: parsed.start, end_time: parsed.end });
                } else {
                    await onCreateAssignment({ staffId, data: date, start_time: parsed.start, end_time: parsed.end, postazione: 'TBD' });
                }
            } else if (parsed?.type === 'HR' && parsed.code) {
                // Handle Justification
                const map: Record<string, string> = { 'FER': 'FERIE', 'MAL': 'MALATTIA', 'ROL': 'PERMESSO' };
                const p = map[parsed.code] || parsed.code;
                // Usually justification is 0 hours? or contract hours? 
                // For now, let's just set postazione and maybe 00:00-00:00 to indicate full day?
                // Or keep valid times if we want to track hours?
                // Let's assume standard 8h for simplicity or full day?
                // User asked to "update effective hours". We need backend logic for that. 
                // For UI, we save postazione=FERIE.

                if (currentAsn) {
                    await onUpdateAssignment(currentAsn.id, { postazione: p });
                } else {
                    await onCreateAssignment({ staffId, data: date, start_time: '00:00', end_time: '00:00', postazione: p });
                }
            } else if (parsed?.type === 'TASK') {
                if (currentAsn) {
                    await onUpdateAssignment(currentAsn.id, { postazione: parsed.code });
                }
            }
        } catch (e: any) {
            alert(e.message);
        }

        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            commitEdit();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    return (
        <div className="flex-1 overflow-auto relative bg-white select-none">
            <table className="w-full border-collapse text-xs min-w-[1000px]">
                <thead className="bg-[#f8fafc] sticky top-0 z-20 shadow-sm border-b border-gray-200">
                    <tr>
                        <th className="sticky left-0 bg-[#f8fafc] p-3 text-left w-[200px] z-30">Dipendente</th>
                        {days.map(d => (
                            <th key={d} className="p-2 text-center border-l w-[160px]">
                                {new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {staff.map(s => (
                        <tr key={s.id} className="border-b hover:bg-gray-50">
                            <td className="sticky left-0 bg-white p-2 font-bold border-r z-10">{s.nome} {s.cognome}</td>
                            {days.map(d => {
                                const lunch = getShift(s.id, d, 'PRANZO');
                                const dinner = getShift(s.id, d, 'SERA');

                                // Helper to render cell content
                                const renderCell = (asn?: Assignment, type: 'PRANZO' | 'SERA' = 'PRANZO') => {
                                    const isEditing = editingCell?.staffId === s.id && editingCell?.date === d && editingCell?.type === type;

                                    if (isEditing) {
                                        return (
                                            <input
                                                ref={inputRef}
                                                className="w-full h-full p-1 border-2 border-blue-500 rounded outline-none text-center bg-white"
                                                value={inputValue}
                                                onChange={e => setInputValue(e.target.value)}
                                                onBlur={commitEdit} // Commit on blur? or just close? usually Excel commits on blur
                                                onKeyDown={handleKeyDown}
                                            />
                                        );
                                    }

                                    if (!asn) return <div className="text-gray-200">-</div>;

                                    // Visuals
                                    const time = asn.start_time ? `${asn.start_time.substring(0, 5)}-${asn.end_time?.substring(0, 5)}` : '??-??';
                                    const isHR = ['FERIE', 'MALATTIA', 'PERMESSO'].includes(asn.postazione);

                                    if (isHR) {
                                        return <div className="font-bold text-amber-600 bg-amber-50 rounded px-1">{asn.postazione.substring(0, 3)}</div>;
                                    }

                                    return (
                                        <div className="flex flex-col items-center">
                                            <span className="font-medium text-indigo-700">{time}</span>
                                            {asn.postazione !== 'TBD' && <span className="text-[10px] text-gray-400">{asn.postazione}</span>}
                                        </div>
                                    );
                                };

                                return (
                                    <td key={d} className="border-l p-0 align-top h-[60px]">
                                        <div className="flex flex-col h-full">
                                            {/* Lunch Half */}
                                            <div
                                                className="flex-1 border-b border-gray-100 flex items-center justify-center cursor-pointer hover:bg-blue-50 transition"
                                                onClick={() => handleCellClick(s.id, d, 'PRANZO', lunch)}
                                            >
                                                {renderCell(lunch, 'PRANZO')}
                                            </div>
                                            {/* Dinner Half */}
                                            <div
                                                className="flex-1 flex items-center justify-center cursor-pointer hover:bg-indigo-50 transition"
                                                onClick={() => handleCellClick(s.id, d, 'SERA', dinner)}
                                            >
                                                {renderCell(dinner, 'SERA')}
                                            </div>
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
