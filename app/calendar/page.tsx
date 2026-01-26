
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import QuarterTimeInput from '@/components/QuarterTimeInput';
import { Calendar, Save, Trash2, Download, Upload, AlertTriangle, CheckCircle, Wand2, Paintbrush, Clock, DollarSign, TrendingUp, Target, UserPlus } from 'lucide-react';
import { getWeekNumber, getWeekRange, getDatesInRange, getWeeksList } from '@/lib/date-utils';
import StaffSelectionModal from '@/components/StaffSelectionModal';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { DraggableShiftItem } from '@/components/DraggableShiftItem';
import { DroppableCell } from '@/components/DroppableCell';
import { ContextMenu } from '@/components/ShiftContextMenu';

// --- Helpers ---

// ...

export default function CalendarPage() {
    // ... state ...
    const [schedule, setSchedule] = useState<Assignment[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [matrix, setMatrix] = useState<Record<number, Record<string, Assignment[]>>>({});
    const [unavailabilities, setUnavailabilities] = useState<any[]>([]);

    const [budgets, setBudgets] = useState<any[]>([]);
    const [forecastData, setForecastData] = useState<string[][]>([]);

    const [currentYear, setCurrentYear] = useState(2025);
    const [selectedWeek, setSelectedWeek] = useState(42);
    const [range, setRange] = useState(getWeekRange(42, 2025));
    const [missingShifts, setMissingShifts] = useState<any[]>([]);
    const [showMissingModal, setShowMissingModal] = useState(false);
    const [manualAssignOpen, setManualAssignOpen] = useState(false);
    const [manualAssignContext, setManualAssignContext] = useState<any>(null);

    const [panarelloActive, setPanarelloActive] = useState(false);
    const [editingCell, setEditingCell] = useState<any>(null);
    const [customTimes, setCustomTimes] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(false);

    // DnD & Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, assignment: Assignment } | null>(null);
    const [clipboard, setClipboard] = useState<Assignment | null>(null);
    const [dragActiveId, setDragActiveId] = useState<number | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Prevent drag on click
            },
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setDragActiveId(null);

        if (!over) return;

        const activeIdStr = active.id.toString();
        // ID format: shift-123
        const assignmentId = Number(activeIdStr.replace('shift-', ''));

        const overIdStr = over.id.toString();
        // ID format: cell-STAFFID|DATE|TYPE
        const parts = overIdStr.split('|');
        if (parts.length < 3) return;

        const [staffIdRaw, dateStr, typeStr] = parts;
        const cleanStaffId = staffIdRaw.replace('cell-', '');

        const newStaffId = Number(cleanStaffId);
        const newDate = dateStr; // YYYY-MM-DD
        const newType = typeStr; // PRANZO | SERA

        console.log('Dropped:', assignmentId, 'to', newStaffId, newDate, newType);

        const currentAsn = schedule.find(a => a.id === assignmentId);
        if (!currentAsn) return;

        try {
            await api.updateAssignment(assignmentId, {
                staffId: newStaffId,
                data: newDate,
            });
            loadData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, asn: Assignment) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, assignment: asn });
    };

    const handleMenuAction = async (action: string) => {
        if (!contextMenu) return;
        const asn = contextMenu.assignment;

        if (action === 'copy') {
            setClipboard(asn);
        } else if (action === 'paste') {
            // Paste logic
        } else if (action === 'delete') {
            if (confirm('Eliminare turno?')) {
                await api.deleteAssignment(asn.id);
                loadData();
            }
        }
        setContextMenu(null);
    };

    // --- Persistence & Calculation ---
    useEffect(() => {
        // Restore from LocalStorage (GLOBAL KEYS)
        const savedWeek = localStorage.getItem('global_week_number');
        const savedYear = localStorage.getItem('global_year');

        let w = savedWeek ? parseInt(savedWeek) : getWeekNumber();
        let y = savedYear ? parseInt(savedYear) : new Date().getFullYear();

        // Verify validity roughly
        if (isNaN(w) || w < 1 || w > 53) w = getWeekNumber();
        if (isNaN(y)) y = new Date().getFullYear();

        // If nothing was saved, SAVE DEFAULT NOW to ensure consistency across pages
        if (!savedWeek || !savedYear) {
            localStorage.setItem('global_week_number', w.toString());
            localStorage.setItem('global_year', y.toString());
        }

        setSelectedWeek(w);
        setCurrentYear(y);
        setRange(getWeekRange(w, y));
    }, []);

    useEffect(() => {
        loadData();
    }, [range]);

    const changeWeek = (w: number, y: number = currentYear) => {
        // Save to LocalStorage (GLOBAL KEYS)
        localStorage.setItem('global_week_number', w.toString());
        localStorage.setItem('global_year', y.toString());

        const r = getWeekRange(w, y);
        setRange(r);
        setSelectedWeek(w);
        setCurrentYear(y);
    };

    async function loadData() {
        setLoading(true);
        try {
            const [sch, stf, tmpl, unav, bdg, fcst, audit] = await Promise.all([
                api.getSchedule(range.start, range.end),
                api.getStaff(),
                api.getShiftTemplates(),
                api.getUnavailability(range.start, range.end),
                api.getBudget(range.start, range.end),
                api.getForecast(range.start, range.start),
                api.auditSchedule(range.start, range.end).catch(() => []) // Audit silently
            ]);

            const safeSch = Array.isArray(sch) ? sch : [];
            setSchedule(safeSch);
            setBudgets(Array.isArray(bdg) ? bdg : []);

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

            // Parse Forecast Data
            if (fcst && fcst.length > 0 && fcst[0].data) {
                try {
                    const parsed = JSON.parse(fcst[0].data);
                    console.log('✅ Forecast data loaded:', parsed.length, 'rows');
                    console.log('Forecast headers:', parsed[0]);
                    setForecastData(parsed);
                } catch (e) {
                    console.warn('❌ Failed to parse forecast data:', e);
                    setForecastData([]);
                }
            } else {
                console.warn('⚠️ No forecast data found for week:', range.start);
                setForecastData([]);
            }

            // Build Matrix
            const m: Record<number, Record<string, Assignment[]>> = {};
            safeStf.forEach((s: any) => { m[s.id] = {}; });
            safeSch.forEach((asn: any) => {
                if (!m[asn.staffId]) m[asn.staffId] = {};
                if (!m[asn.staffId][asn.data]) m[asn.staffId][asn.data] = [];
                m[asn.staffId][asn.data].push(asn);
            });
            setMatrix(m);

            // Set Audit Result
            if (Array.isArray(audit)) {
                setMissingShifts(audit);
                // Don't auto-open modal on load, just show the alert button
            }

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

        // Clean and validate time strings
        const cleanTime = (time: string) => {
            // Remove any extra whitespace and take only the time part (HH:MM)
            const cleaned = time.trim().split(' ')[0];
            return cleaned;
        };

        const startClean = cleanTime(start);
        const endClean = cleanTime(end);

        // Validate format HH:MM
        if (!/^\d{1,2}:\d{2}$/.test(startClean) || !/^\d{1,2}:\d{2}$/.test(endClean)) {
            console.warn(`Invalid time format: start="${start}", end="${end}"`);
            return 0;
        }

        const [h1, m1] = startClean.split(':').map(Number);
        const [h2, m2] = endClean.split(':').map(Number);

        // Validate parsed numbers
        if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) {
            console.warn(`Failed to parse time: start="${start}", end="${end}"`);
            return 0;
        }

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

    // Helper to parse Italian number format from forecast
    const parseNumberIT = (val: any) => {
        if (typeof val === 'number') {
            return isFinite(val) ? val : 0;
        }
        if (!val) return 0;
        let s = String(val).trim();
        // Handle Excel errors
        if (s.includes('#') || s.includes('Ð') || s.toLowerCase() === 'nan') return 0;

        s = s.replace(/€/g, '').replace(/[^0-9.,-]/g, '');

        // CRITICAL FIX: If has comma, it's Italian format (1.234,56)
        // If no comma, dot is decimal separator (1234.56) - DON'T remove it!
        if (s.includes(',')) {
            s = s.replace(/\./g, '').replace(',', '.');
        }
        // else: keep dots as decimal separators

        const res = parseFloat(s);
        return isFinite(res) ? res : 0;
    };

    // Helper to extract forecast value by row name and day index (Finds LAST matching row)
    const getForecastValue = (rowName: string, dayIndex: number): number => {
        if (!forecastData || forecastData.length === 0) return 0;

        // Search in reverse to find the last occurrence
        for (let i = forecastData.length - 1; i >= 0; i--) {
            const row = forecastData[i];
            const label = String(row[0] || '').toLowerCase();

            // Flexible matching:
            // If rowName is 'ore budget', match if label has both 'ore' and 'budget'
            // If rowName is 'budget pranzo', match if label has 'budget' and 'pranzo'
            const keywords = rowName.toLowerCase().split(' ');
            const match = keywords.every(k => label.includes(k));

            if (match) {
                if (!row[dayIndex + 1]) return 0;
                return parseNumberIT(row[dayIndex + 1]);
            }
        }
        return 0;
    };

    // --- Missing Shifts UI State ---
    // --- Actions ---
    const generate = async () => {
        if (!confirm("Generare i turni sovrascriverà eventuali bozze. Continuare?")) return;
        try {
            setLoading(true);
            const res = await api.generateSchedule(range.start, range.end) as any;

            if (res.success) {
                // Handle Missing Shifts
                if (res.unassigned && res.unassigned.length > 0) {
                    setMissingShifts(res.unassigned);
                    alert(`Generazione Completata!\nTurni assegnati: ${res.count}\n⚠️ ATTENZIONE: ${res.unassigned.length} postazioni non coperte.`);
                    setShowMissingModal(true);
                } else {
                    setMissingShifts([]);
                    alert(`Generazione Completata! ${res.count} turni creati.`);
                }
                loadData();
            } else {
                alert('Errore Generazione: ' + res.error);
            }
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

    const openManualAssign = (m: any, index: number) => {
        // Determine shift type
        const h = parseInt(m.start.split(':')[0]);
        const shiftType = h < 17 ? 'lunch' : 'dinner';
        setManualAssignContext({ ...m, index, shift: shiftType });
        setManualAssignOpen(true);
    };

    const handleManualSelect = async (staffId: number) => {
        if (!manualAssignContext) return;
        try {
            const { date, start, end, station, index } = manualAssignContext;

            await api.createAssignment({
                data: date,
                staffId,
                start_time: start,
                end_time: end,
                postazione: station,
                status: true
            });

            // Remove from missing list locally
            const newMissing = [...missingShifts];
            newMissing.splice(index, 1);
            setMissingShifts(newMissing);

            // If empty, close missing modal
            if (newMissing.length === 0) setShowMissingModal(false);

            setManualAssignOpen(false);
            setManualAssignContext(null);
            loadData(); // Refresh calendar
        } catch (e: any) {
            alert("Errore assegnazione: " + e.message);
        }
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
            <div className="bg-white border-b border-gray-200 p-4 flex flex-wrap gap-4 items-center justify-between z-30 shadow-sm sticky top-0">
                <div className="flex items-center gap-6">
                    <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-800 tracking-tight">
                        <Calendar className="text-blue-600" size={28} />
                        Turni
                    </h1>

                    <div className="flex items-center gap-0 bg-gray-50 p-1 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2 px-3 py-1 border-r border-gray-200">
                            <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">ANNO</span>
                            <input
                                type="number"
                                className="bg-transparent font-bold w-12 text-sm outline-none text-gray-700"
                                value={currentYear}
                                onChange={e => changeWeek(selectedWeek, parseInt(e.target.value))}
                            />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1">
                            <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">SETTIMANA</span>
                            <select
                                className="bg-transparent font-bold text-sm outline-none cursor-pointer text-gray-700"
                                value={selectedWeek}
                                onChange={e => changeWeek(parseInt(e.target.value))}
                            >
                                {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                                    <option key={w} value={w}>Week {w}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="text-sm text-gray-400 font-medium">
                        {range.start.split('-').reverse().join('/')} - {range.end.split('-').reverse().join('/')}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {missingShifts.length > 0 && (
                        <button
                            onClick={() => setShowMissingModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-xs font-bold transition border border-red-100 animate-pulse"
                        >
                            <AlertTriangle size={16} />
                            {missingShifts.length} Mancanti
                        </button>
                    )}

                    <button onClick={generate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-md shadow-blue-200 transition">
                        <Wand2 size={16} /> AI Expert
                    </button>

                    <div className="h-8 w-px bg-gray-200 mx-2"></div>

                    <button
                        onClick={() => setPanarelloActive(!panarelloActive)}
                        className={`p-2 rounded-lg transition border ${panarelloActive ? 'bg-yellow-50 border-yellow-200 text-yellow-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'}`}
                        title="Modalità Panarello (Conferma Rapida)"
                    >
                        <Paintbrush size={18} />
                    </button>

                    <button onClick={clearAll} className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Cancella Tutto">
                        <Trash2 size={18} />
                    </button>

                    <div className="flex gap-4 px-4 py-2 bg-white border border-gray-200 rounded-lg items-center text-xs shadow-sm ml-2">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Budget</span>
                            <span className="text-gray-800 font-bold">{stats.totalContractHours}h</span>
                        </div>
                        <div className="w-px h-6 bg-gray-100"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Effettivo</span>
                            <span className="text-blue-600 font-bold">{stats.totalAssignedHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}h</span>
                        </div>
                        <div className="w-px h-6 bg-gray-100"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Diff</span>
                            <span className={`font-bold ${stats.diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{stats.diff.toFixed(1)}h</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            {/* Calendar Grid */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={(e) => setDragActiveId(Number(e.active.id.toString().replace('shift-', '')))}>
                <div className="flex-1 overflow-auto relative bg-white">
                    <table className="w-full border-collapse text-xs min-w-[1500px]">
                        <thead className="bg-[#f8fafc] sticky top-0 z-20 shadow-sm border-b border-gray-200">
                            <tr>
                                <th className="sticky left-0 bg-[#f8fafc] border-b border-r border-gray-200 p-3 min-w-[40px] z-30 text-gray-400 font-medium">#</th>
                                <th className="sticky left-[40px] bg-[#f8fafc] border-b border-r border-gray-200 p-3 min-w-[150px] text-left z-30 text-gray-500 font-bold tracking-wide uppercase">STAFF</th>
                                <th className="sticky left-[190px] bg-[#f8fafc] border-b border-r border-gray-200 p-3 min-w-[50px] z-30 text-gray-500 font-bold tracking-wide uppercase">CTR.</th>
                                <th className="sticky left-[240px] bg-[#f8fafc] border-b border-r border-gray-200 p-3 min-w-[50px] z-30 text-gray-500 font-bold tracking-wide uppercase">EFF.</th>
                                {days.map((d, i) => (
                                    <th key={d} colSpan={2} className="border-b border-r border-gray-200 p-2 text-center bg-[#f8fafc]">
                                        <div className="font-bold text-gray-700 uppercase tracking-wide">{new Date(d).toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                                        <div className="text-[10px] text-gray-400 font-medium">{d.split('-').slice(1).join('/')}</div>
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
                                        <th className="bg-blue-50/50 border-b border-r border-gray-200 text-[10px] w-[140px] text-center font-semibold text-blue-800 py-1">PRANZO</th>
                                        <th className="bg-indigo-50/50 border-b border-r border-gray-200 text-[10px] w-[140px] text-center font-semibold text-indigo-800 py-1">CENA</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {staff.map((s, idx) => {
                                let totalHours = 0;
                                days.forEach(d => {
                                    const l = getShift(s.id, d, 'PRANZO');
                                    const dn = getShift(s.id, d, 'SERA');
                                    if (l && l.start_time && l.end_time) totalHours += calcHours(l.start_time, l.end_time);
                                    if (dn && dn.start_time && dn.end_time) totalHours += calcHours(dn.start_time, dn.end_time);
                                });
                                const budgetDiff = totalHours - (s.oreMassime || 0);
                                const budgetColor = budgetDiff > 2 ? 'bg-red-50 text-red-700' : (budgetDiff < -2 ? 'bg-blue-50 text-blue-700' : 'text-gray-600');

                                return (
                                    <tr key={s.id} className="hover:bg-gray-50 border-b border-gray-100 group h-[50px]">
                                        <td className="sticky left-0 bg-white border-r p-2 text-center text-gray-400 group-hover:bg-gray-50 z-10">{idx + 1}</td>
                                        <td className="sticky left-[40px] bg-white border-r p-2 font-medium text-gray-800 text-left group-hover:bg-gray-50 z-10 truncate max-w-[150px]">{s.nome} {s.cognome}</td>
                                        <td className="sticky left-[190px] bg-white border-r p-2 text-center text-gray-500 group-hover:bg-gray-50 z-10">{s.oreMassime}</td>
                                        <td className={`sticky left-[240px] bg-white border-r p-2 text-center font-bold z-10 ${budgetColor} group-hover:bg-gray-50`}>{totalHours.toFixed(1)}</td>

                                        {days.map((d) => {
                                            const lunch = getShift(s.id, d, 'PRANZO');
                                            const dinner = getShift(s.id, d, 'SERA');

                                            return (
                                                <React.Fragment key={d}>
                                                    <DroppableCell staffId={s.id} date={d} type="PRANZO">
                                                        {lunch && (
                                                            <DraggableShiftItem
                                                                assignment={lunch}
                                                                type="PRANZO"
                                                                onUpdate={(id, val) => api.updateAssignment(id, val).then(loadData).catch(e => alert(e.message))}
                                                                onContextMenu={handleContextMenu}
                                                            />
                                                        )}
                                                    </DroppableCell>
                                                    <DroppableCell staffId={s.id} date={d} type="SERA">
                                                        {dinner && (
                                                            <DraggableShiftItem
                                                                assignment={dinner}
                                                                type="SERA"
                                                                onUpdate={(id, val) => api.updateAssignment(id, val).then(loadData).catch(e => alert(e.message))}
                                                                onContextMenu={handleContextMenu}
                                                            />
                                                        )}
                                                    </DroppableCell>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-white sticky bottom-0 z-40 font-sans shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-indigo-100">
                            {/* Simplified Footer for 2-col structure */}
                            <tr className="bg-gray-50 font-bold border-t">
                                <td className="sticky left-0 p-3 bg-gray-50" colSpan={4}>TOTALE ORE</td>
                                {days.map((d, i) => {
                                    // Calc stats
                                    const stats = { l: 0, d: 0 };
                                    staff.forEach(s => {
                                        const l = getShift(s.id, d, 'PRANZO');
                                        const dn = getShift(s.id, d, 'SERA');
                                        if (l?.start_time && l?.end_time) stats.l += calcHours(l.start_time, l.end_time);
                                        if (dn?.start_time && dn?.end_time) stats.d += calcHours(dn.start_time, dn.end_time);
                                    });
                                    return (
                                        <React.Fragment key={i}>
                                            <td className="p-2 text-center border-r text-blue-700">{stats.l > 0 ? stats.l.toFixed(1) : '-'}</td>
                                            <td className="p-2 text-center border-r text-indigo-700">{stats.d > 0 ? stats.d.toFixed(1) : '-'}</td>
                                        </React.Fragment>
                                    )
                                })}
                            </tr>
                        </tfoot>
                    </table>

                    {contextMenu && (
                        <ContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            onClose={() => setContextMenu(null)}
                            onAction={handleMenuAction}
                        />
                    )}
                </div>
                <DragOverlay>
                    {dragActiveId ? (
                        <div className="bg-white border-2 border-blue-500 shadow-2xl p-2 rounded w-[120px] h-[50px] flex items-center justify-center font-bold text-blue-600 opacity-90 rotate-3 cursor-grabbing">
                            Spostamento...
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Missing Shifts Modal */}
            {showMissingModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMissingModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-[600px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold text-amber-600 flex items-center gap-2">
                                <AlertTriangle size={24} />
                                Postazioni Mancanti
                            </h3>
                            <button onClick={() => setShowMissingModal(false)} className="text-gray-400 hover:text-gray-600">
                                <Trash2 size={20} className="transform rotate-45" /> {/* Use X icon if available, reusing Trash2 rotated for close X */}
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1">
                            {missingShifts.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">Nessuna postazione mancante.</p>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs sticky top-0">
                                        <tr>
                                            <th className="p-2">Data</th>
                                            <th className="p-2">Orario</th>
                                            <th className="p-2">Postazione</th>
                                            <th className="p-2">Motivo</th>
                                            <th className="p-2 text-right">Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {missingShifts.map((m, i) => (
                                            <tr key={i} className="hover:bg-amber-50">
                                                <td className="p-2 font-medium">{new Date(m.date).toLocaleDateString()}</td>
                                                <td className="p-2 font-mono text-xs">{m.start} - {m.end}</td>
                                                <td className="p-2 font-bold text-gray-700">{m.station}</td>
                                                <td className="p-2 text-xs text-gray-500 italic">{m.reason}</td>
                                                <td className="p-2 text-right">
                                                    <button
                                                        onClick={() => openManualAssign(m, i)}
                                                        className="p-1 px-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs font-bold flex items-center gap-1 ml-auto"
                                                    >
                                                        <UserPlus size={14} /> Assegna
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t text-xs text-gray-400 text-center">
                            Questi turni richiedono attenzione manuale poiché nessun dipendente idoneo è stato trovato dalle regole automatiche.
                        </div>
                    </div>
                </div>
            )}

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

            {/* Staff Selection Modal for Manual Assignment */}
            {manualAssignContext && (
                <StaffSelectionModal
                    isOpen={manualAssignOpen}
                    onClose={() => { setManualAssignOpen(false); setManualAssignContext(null); }}
                    onSelect={handleManualSelect}
                    date={manualAssignContext.date}
                    postazione={manualAssignContext.station}
                    shift={manualAssignContext.shift}
                    orari={{ start: manualAssignContext.start, end: manualAssignContext.end }}
                    staff={staff}
                    existingAssignments={schedule}
                    weeklyHours={(() => {
                        const map: Record<number, number> = {};
                        staff.forEach(s => {
                            let total = 0;
                            // Re-use logic from matrix or stats?
                            // Matrix is faster
                            const sMatrix = matrix[s.id] || {};
                            Object.keys(sMatrix).forEach(d => {
                                sMatrix[d].forEach(a => {
                                    const sT = a.start_time || a.shiftTemplate?.oraInizio;
                                    const eT = a.end_time || a.shiftTemplate?.oraFine;
                                    if (sT && eT) total += calcHours(sT, eT);
                                });
                            });
                            map[s.id] = total;
                        });
                        return map;
                    })()}
                />
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
