
'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Eye, EyeOff, Save, X, Trash2, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
// api not used here anymore if we remove the POST call
import Link from 'next/link';
import * as XLSX from 'xlsx';
import SearchableSelect from '@/components/SearchableSelect';

import { getWeekRange, getDatesInRange } from '@/lib/date-utils';

const INTERVALS: string[] = [];
let h = 6, m = 0;
for (let i = 0; i < 96; i++) {
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    INTERVALS.push(`${hh}:${mm}`);
    m += 15;
    if (m === 60) { m = 0; h = (h + 1) % 24; }
}

function isTimeInRange(time: string, start: string, end: string) {
    if (!start || !end) return false;
    const toMinds = (t: string) => {
        if (!t) return 0;
        // Handle ISO (2023-01-01T17:00:00) or simple (17:00)
        const timePart = t.includes('T') ? t.split('T')[1] : t;
        const clean = timePart.replace(/[^\d:]/g, ''); // Remove non-digits/colons
        const [hh, mm] = clean.split(':').map(Number);
        return (hh || 0) * 60 + (mm || 0);
    }
    let tVal = toMinds(time);
    let sVal = toMinds(start);
    let eVal = toMinds(end);

    if (tVal < 6 * 60) tVal += 1440;
    if (sVal < 6 * 60) sVal += 1440;
    if (eVal < 6 * 60) eVal += 1440;
    if (eVal < sVal) eVal += 1440;

    return tVal >= sVal && tVal < eVal;
}

const CoverageDetailsContent = () => {
    const searchParams = useSearchParams();

    // Config State - Initialize with Safe Defaults (Server Compatible)
    const [currentYear, setCurrentYear] = useState(2025);
    const [week, setWeek] = useState(1);
    const [isInitialized, setIsInitialized] = useState(false);
    const [loading, setLoading] = useState(false);

    // Defer actual date calculation to client-side effect
    useEffect(() => {
        const urlYear = searchParams.get('year');
        const urlWeek = searchParams.get('week');

        if (urlYear && urlWeek) {
            setCurrentYear(parseInt(urlYear));
            setWeek(parseInt(urlWeek));
        } else {
            const today = new Date();
            setCurrentYear(today.getFullYear());
            setWeek(getWeekNumber(today));
        }
        setIsInitialized(true);
    }, [searchParams]);

    const [rows, setRows] = useState<any[]>([]);
    const [fixedShifts, setFixedShifts] = useState<any[]>([]);
    const [selectedDayIdx, setSelectedDayIdx] = useState(0);
    const [showSimulation, setShowSimulation] = useState(true); // Default ON

    const [showAllStaff, setShowAllStaff] = useState(false);
    const [assignmentModal, setAssignmentModal] = useState<{
        isOpen: boolean;
        station: string;
        date: string; // YYYY-MM-DD
        timeStart: string; // HH:mm
        timeEnd: string; // HH:mm
        currentAssignmentId?: number;
        staffId?: number;
    }>({
        isOpen: false,
        station: '',
        date: '',
        timeStart: '',
        timeEnd: '',
    });

    useEffect(() => {
        const pYear = searchParams.get('year');
        const pWeek = searchParams.get('week');
        const savedWeek = localStorage.getItem('calendar_week');
        const savedYear = localStorage.getItem('calendar_year');

        if (pYear) setCurrentYear(parseInt(pYear));
        else if (savedYear) setCurrentYear(parseInt(savedYear));

        if (pWeek) setWeek(parseInt(pWeek));
        else if (savedWeek) setWeek(parseInt(savedWeek));

        setIsInitialized(true);
    }, [searchParams]);

    // Save persistence
    useEffect(() => {
        if (!isInitialized) return;
        localStorage.setItem('calendar_week', week.toString());
        localStorage.setItem('calendar_year', currentYear.toString());
    }, [week, currentYear, isInitialized]);

    const { start: weekStart, end: weekEnd } = getWeekRange(week, currentYear);
    const days = getDatesInRange(weekStart, weekEnd);
    const currentDayDate = days[selectedDayIdx]; // e.g. "2025-10-13"

    // Load Data
    // Load Data
    const [assignments, setAssignments] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);

    const loadData = () => {
        if (!weekStart) return;
        setLoading(true);

        const calcEnd = new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Use api client for consistency (no-store validation)
        const p1 = api.getCoverage(weekStart);
        const p2 = api.getRecurringShifts();
        const p3 = api.getSchedule(weekStart, calcEnd);
        const p4 = api.getStaff();

        Promise.all([p1, p2, p3, p4])
            .then(([reqData, shiftData, scheduleData, staffData]) => {
                if (Array.isArray(reqData)) {
                    setRows(reqData.map((r: any) => ({
                        station: r.station,
                        slots: typeof r.slots === 'string' ? JSON.parse(r.slots) : r.slots,
                        extra: typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra,
                    })));
                } else setRows([]);

                if (Array.isArray(shiftData)) setFixedShifts(shiftData);
                if (Array.isArray(scheduleData)) setAssignments(scheduleData);
                if (Array.isArray(staffData)) setStaffList(staffData);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadData();
    }, [weekStart]);

    // Derived Date details
    const currentDayOfWeek = selectedDayIdx + 1; // 1..7 (Mon..Sun)

    // Normalize helper
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Filter shifts for this day and map by station
    const shiftsByStation: Record<string, { staff: string, times: string[], assignmentId?: number }[]> = {};

    // 1. Process Fixed Shifts (Simulation)
    fixedShifts.forEach(shift => {
        if (!showSimulation) return; // Skip if toggled off
        if (shift.dayOfWeek !== currentDayOfWeek) return;
        if (!shift.postazione) return;

        // Check Week Bounds
        if (shift.startWeek && week < shift.startWeek) return;
        if (shift.endWeek && week > shift.endWeek) return;
        if (shift.startYear && currentYear < shift.startYear) return;
        if (shift.endYear && currentYear > shift.endYear) return;

        // Check if there is an ACTUAL assignment for this staff on this day
        // If so, the ACTUAL assignment should supersede the fixed shift (avoid double counting if they differ, or duplicate visual)
        // However, usually Simulation shows "What should be".
        // Let's decide: Show Union?
        // Logic: If I manually assigned, I want to see THAT.
        // If I haven't, I want to see Fixed.
        // Let's check overlap later or just dump all.
        // User complaint: "Manual 17:00 not showing".

        const normStation = normalize(shift.postazione);
        if (!shiftsByStation[normStation]) shiftsByStation[normStation] = [];

        // Calculate Times
        const times: string[] = [];
        INTERVALS.forEach(time => {
            if (isTimeInRange(time, shift.start_time, shift.end_time)) {
                times.push(time);
            }
        });

        if (times.length > 0) {
            const staffName = shift.staff ? `${shift.staff.nome} ${shift.staff.cognome}` : 'N/A';
            shiftsByStation[normStation].push({ staff: staffName + ' (Fixed)', times });
        }
    });

    // 2. Process Actual Assignments
    assignments.forEach(asn => {
        // Fix: asn.data is ISO (2026-02-02T00:00:00.000Z), currentDayDate is YYYY-MM-DD
        // We need to compare specific dates.
        // If asn.data is '2026-02-02', it works.
        // If asn.data is '2026-02-01T23:00:00.000Z' (which is Feb 2 in CET), we need to check the LOCAL date.

        let match = false;
        if (typeof asn.data === 'string') {
            if (asn.data === currentDayDate) match = true;
            else if (asn.data.includes('T')) {
                const d = new Date(asn.data);
                // Format to YYYY-MM-DD in local time
                const localYMD = d.toLocaleDateString('fr-CA'); // 'fr-CA' is YYYY-MM-DD
                if (localYMD === currentDayDate) match = true;

                // Fallback: Check if it splits to currentDayDate (for pure UTC dates)
                if (!match && asn.data.split('T')[0] === currentDayDate) match = true;
            }
        }

        if (!match) return;
        if (!asn.postazione) return;

        const normStation = normalize(asn.postazione);
        if (!shiftsByStation[normStation]) shiftsByStation[normStation] = [];

        // Resolve staff name
        const stf = staffList.find(s => s.id === asn.staffId);
        const staffName = stf ? `${stf.nome} ${stf.cognome}` : `Staff ${asn.staffId}`;

        // Calculate Times
        const times: string[] = [];
        const start = asn.start_time || asn.shiftTemplate?.oraInizio;
        const end = asn.end_time || asn.shiftTemplate?.oraFine;

        if (start && end) {
            INTERVALS.forEach(time => {
                if (isTimeInRange(time, start, end)) {
                    times.push(time);
                }
            });
        }

        if (times.length > 0) {
            shiftsByStation[normStation].push({ staff: staffName, times, assignmentId: asn.id });
        }
    });

    // Build Grid
    const gridRows = rows.map(r => {
        // Skip inactive
        if (r.extra?.active === false) return null;

        const s = r.slots[currentDayDate] || { lIn: '', lOut: '', dIn: '', dOut: '' };

        // Get covered times for this station
        const normReqStation = normalize(r.station);

        // Metadata for cells
        const cellData = INTERVALS.map(time => {
            let covered = false;
            let coveringStaff: string[] = [];
            let assignmentIds: number[] = [];

            // Check matches
            Object.keys(shiftsByStation).forEach(shiftKey => {
                if (normReqStation === shiftKey) {
                    shiftsByStation[shiftKey].forEach(entry => {
                        if (entry.times.includes(time)) {
                            covered = true;
                            if (!coveringStaff.includes(entry.staff)) coveringStaff.push(entry.staff);
                            if (entry.assignmentId) assignmentIds.push(entry.assignmentId);
                        }
                    });
                }
            });

            // Is Required?
            let required = false;
            if ((s.lIn && isTimeInRange(time, s.lIn, s.lOut)) || (s.dIn && isTimeInRange(time, s.dIn, s.dOut))) {
                required = true;
            }

            let status = 0;
            if (required && covered) status = 3;
            else if (required && !covered) status = 1;
            else if (!required && covered) status = 2;

            return { status, staff: coveringStaff.join(', '), assignmentId: assignmentIds[0] }; // Take first if multiple
        });

        const splitIdx = INTERVALS.indexOf('16:00'); // Split at 16:00 (Lunch ends at 15:45)

        let totalReqLunch = 0;
        let totalCovLunch = 0;
        let totalReqDinner = 0;
        let totalCovDinner = 0;

        cellData.forEach((c, i) => {
            const isLunch = i < splitIdx;
            if (c.status === 1 || c.status === 3) {
                if (isLunch) totalReqLunch += 0.25;
                else totalReqDinner += 0.25;
            }
            if (c.status === 2 || c.status === 3) {
                if (isLunch) totalCovLunch += 0.25;
                else totalCovDinner += 0.25;
            }
        });

        // Keep old totals for backward compatibility if needed, or sum them up
        const totalReq = totalReqLunch + totalReqDinner;
        const totalCov = totalCovLunch + totalCovDinner;

        return { station: r.station, meta: s, cells: cellData, totalReq, totalCov, totalReqLunch, totalCovLunch, totalReqDinner, totalCovDinner };
    }).filter(r => r !== null) as any[];

    // Column Totals (Required)
    const colTotalsReq = INTERVALS.map((_, i) => gridRows.reduce((sum, r) => sum + (r.cells[i] === 1 || r.cells[i] === 3 ? 0.25 : 0), 0));

    const exportCsv = () => {
        const header1 = ["Postazione", "Turno 1 Start", "Turno 1 End", "Turno 2 Start", "Turno 2 End", ...INTERVALS, "REQ PRANZO", "COV PRANZO", "REQ CENA", "COV CENA"];
        const data = gridRows.map(r => [
            r.station,
            r.meta.lIn, r.meta.lOut, r.meta.dIn, r.meta.dOut,
            ...r.cells.map((c: number) => {
                if (c === 3) return "OK";
                if (c === 1) return "REQ";
                if (c === 2) return "COV";
                return "";
            }),
            r.totalReqLunch.toFixed(2).replace('.', ','),
            r.totalCovLunch.toFixed(2).replace('.', ','),
            r.totalReqDinner.toFixed(2).replace('.', ','),
            r.totalCovDinner.toFixed(2).replace('.', ',')
        ]);
        const ws = XLSX.utils.aoa_to_sheet([header1, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dettaglio");
        XLSX.writeFile(wb, `Dettaglio_${currentDayDate}.xlsx`);
    };

    const handleToggleSimulation = () => {
        setShowSimulation(!showSimulation);
    };

    const handleApplySync = async () => {
        if (!confirm(`Vuoi applicare (copiare) i turni fissi per la settimana ${week}/${currentYear}? I turni esistenti verranno aggiornati, i nuovi creati.`)) return;

        try {
            setLoading(true);
            const res = await api.applyFixedShifts(currentYear, week);
            alert(`Operazione completata! Processati: ${res.processed} turni.`);
            loadData(); // Reload to see real shifts
        } catch (e: any) {
            alert('Errore sync: ' + e.message);
            setLoading(false);
        }
    };

    // Focus management
    const lastFocusedCell = useRef<HTMLElement | null>(null);

    // Assignment Handlers
    const handleCellClick = (station: string, time: string, currentAssignmentId?: number, currentStaff?: string) => {
        // Capture focus before opening modal
        lastFocusedCell.current = document.activeElement as HTMLElement;

        // Calculate end time (default +1 hour, or until end of shift block)
        const [hh, mm] = time.split(':').map(Number);
        const endH = (hh + 4) % 24;
        const endTime = `${endH.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;

        let initialData = {
            station,
            date: currentDayDate,
            timeStart: time,
            timeEnd: endTime,
            staffId: undefined as number | undefined
        };

        if (currentAssignmentId) {
            const asn = assignments.find(a => a.id === currentAssignmentId);
            if (asn) {
                initialData.timeStart = asn.start_time || asn.shiftTemplate?.oraInizio || time;
                initialData.timeEnd = asn.end_time || asn.shiftTemplate?.oraFine || endTime;
                initialData.staffId = asn.staffId;
            }
        }

        setAssignmentModal({
            isOpen: true,
            station,
            date: currentDayDate,
            timeStart: initialData.timeStart,
            timeEnd: initialData.timeEnd,
            currentAssignmentId,
            staffId: initialData.staffId
        });
    };

    const handleSaveAssignment = async () => {
        if (!assignmentModal.staffId) return alert("Seleziona un dipendente");
        if (!assignmentModal.timeStart || !assignmentModal.timeEnd) return alert("Orari mancanti");

        try {
            setLoading(true);
            const payload = {
                staffId: assignmentModal.staffId,
                postazione: assignmentModal.station,
                data: assignmentModal.date,
                start_time: assignmentModal.timeStart,
                end_time: assignmentModal.timeEnd
            };

            if (assignmentModal.currentAssignmentId) {
                await api.updateAssignment(assignmentModal.currentAssignmentId, payload);
            } else {
                await api.createAssignment(payload);
            }

            setAssignmentModal({ ...assignmentModal, isOpen: false });
            // Restore focus
            if (lastFocusedCell.current) lastFocusedCell.current.focus();
            loadData();
        } catch (e: any) {
            alert("Errore salvataggio: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAssignment = async () => {
        if (!assignmentModal.currentAssignmentId) return;
        if (!confirm("Eliminare questo assegnamento?")) return;

        try {
            setLoading(true);
            await api.deleteAssignment(assignmentModal.currentAssignmentId);
            setAssignmentModal({ ...assignmentModal, isOpen: false });
            // Restore focus
            if (lastFocusedCell.current) lastFocusedCell.current.focus();
            loadData();
        } catch (e: any) {
            alert("Errore eliminazione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGridKeyDown = (e: React.KeyboardEvent, rIdx: number, cIdx: number) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            let nextR = rIdx;
            let nextC = cIdx;

            if (e.key === 'ArrowUp') nextR = Math.max(0, rIdx - 1);
            if (e.key === 'ArrowDown') nextR = rIdx + 1; // Bound check handled by getElementById check
            if (e.key === 'ArrowLeft') nextC = Math.max(0, cIdx - 1);
            if (e.key === 'ArrowRight') nextC = Math.min(INTERVALS.length - 1, cIdx + 1);

            const nextId = `cell-${nextR}-${nextC}`;
            const el = document.getElementById(nextId);
            if (el) el.focus();
        }
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Trigger click
            (e.target as HTMLElement).click();
        }
    };

    const getStaffWeeklyHours = (staffId: number) => {
        const staffAssignments = assignments.filter(a => a.staffId === staffId);
        let totalMinutes = 0;
        staffAssignments.forEach(a => {
            const start = a.start_time || a.shiftTemplate?.oraInizio;
            const end = a.end_time || a.shiftTemplate?.oraFine;
            if (start && end) {
                const [h1, m1] = start.split(':').map(Number);
                const [h2, m2] = end.split(':').map(Number);
                let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (mins < 0) mins += 1440;
                totalMinutes += mins;
            }
        });
        return (totalMinutes / 60).toFixed(1);
    };

    const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <div className="bg-white shadow p-4 flex flex-col gap-4 sticky top-0 z-20 print:hidden">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href={`/requirements?year=${currentYear}&week=${week}`} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-800 tracking-tight">Dettaglio Fabbisogno & Copertura</h1>
                    </div>
                    <button
                        onClick={handleToggleSimulation}
                        className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold shadow-sm transition ${showSimulation ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                    >
                        {showSimulation ? <Eye size={16} /> : <EyeOff size={16} />}
                        {showSimulation ? 'Simulazione Attiva' : 'Mostra Simulazione'}
                    </button>
                    <button
                        onClick={handleApplySync}
                        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-bold shadow-sm transition bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200"
                        title="Copia i turni fissi nel calendario reale"
                    >
                        <Save size={16} /> Applica Turni
                    </button>
                    <button onClick={exportCsv} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-bold shadow-sm">
                        <Download size={16} /> Export
                    </button>
                </div>

                <div className="flex flex-wrap gap-4 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">

                        {/* Week Navigation */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (week > 1) setWeek(week - 1);
                                    else {
                                        setWeek(52);
                                        setCurrentYear(currentYear - 1);
                                    }
                                }}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600 transition"
                            >
                                <ChevronDown size={20} className="rotate-90" />
                            </button>
                            <div className="flex flex-col items-center w-24">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SETTIMANA</span>
                                <span className="text-xl font-bold text-gray-800 leading-none">W{week}</span>
                            </div>
                            <button
                                onClick={() => {
                                    if (week < 52) setWeek(week + 1);
                                    else {
                                        setWeek(1);
                                        setCurrentYear(currentYear + 1);
                                    }
                                }}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600 transition"
                            >
                                <ChevronDown size={20} className="-rotate-90" />
                            </button>
                        </div>

                        <div className="h-8 w-px bg-gray-200"></div>

                        {/* Year Navigation */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentYear(currentYear - 1)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600 transition"
                            >
                                <ChevronDown size={16} className="rotate-90" />
                            </button>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ANNO</span>
                                <span className="text-base font-bold text-gray-700 leading-none">{currentYear}</span>
                            </div>
                            <button
                                onClick={() => setCurrentYear(currentYear + 1)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600 transition"
                            >
                                <ChevronDown size={16} className="-rotate-90" />
                            </button>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-gray-300 mx-2"></div>
                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                        {dayNames.map((n, i) => (
                            <button
                                key={n}
                                onClick={() => setSelectedDayIdx(i)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${selectedDayIdx === i ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'}`}
                            >
                                {n} <span className="text-[10px] font-normal opacity-70 ml-1">{days[i]?.split('-').slice(1).join('/')}</span>
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto flex gap-3 text-xs font-bold items-center">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-200 rounded-sm"></div> Richiesto (0.25)</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-300 rounded-sm"></div> Coperto (Fixed)</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded-sm"></div> Extra</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {loading && <div className="text-center p-10 font-bold text-gray-500 animate-pulse">Caricamento...</div>}

                <div className="bg-white rounded-xl shadow-lg border border-gray-200 inline-block min-w-full">
                    <table className="border-collapse text-xs table-fixed w-full">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                                <th className="p-3 border-r bg-gray-50 sticky left-0 z-20 w-[150px] text-left font-bold uppercase tracking-wider text-[10px]">Postazione</th>
                                {INTERVALS.map(t => (
                                    <th key={t} className={`p-1 border-r min-w-[30px] text-[9px] rotate-90 h-24 align-bottom w-[25px] font-medium text-gray-400 ${t === '15:45' ? 'border-r-4 border-r-gray-300' : ''}`}>{t}</th>
                                ))}
                                <th className="p-1 border-r font-bold bg-yellow-50 w-[40px] text-[10px] text-yellow-700" title="Richiesto Pranzo">REQ P</th>
                                <th className="p-1 border-r font-bold bg-green-50 w-[40px] text-[10px] text-green-700" title="Coperto Pranzo">COV P</th>
                                <th className="p-1 border-r font-bold bg-orange-50 w-[40px] text-[10px] text-orange-700" title="Richiesto Cena">REQ C</th>
                                <th className="p-1 border-r font-bold bg-blue-50 w-[40px] text-[10px] text-blue-700" title="Coperto Cena">COV C</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const CUCINA_KEYWORDS = ['FRITTI', 'DOLCI', 'PREPARAZIONE', 'LAVAGGIO', 'GRIGLIA', 'CUCINA', 'PIRA', 'BURGER', 'PLONGE', 'CUOCO', 'CHEF'];

                                const getCategory = (station: string) => {
                                    const s = station.toUpperCase();
                                    if (s.includes('SALA')) return 'SALA BAR';
                                    if (CUCINA_KEYWORDS.some(k => s.includes(k))) return 'CUCINA';
                                    if (s.includes('JOLLY')) return 'CUCINA';
                                    return 'SALA BAR';
                                };

                                const categorizedRows: Record<string, any[]> = { 'SALA BAR': [], 'CUCINA': [] };
                                const seenStations = new Set<string>();

                                gridRows.forEach(row => {
                                    const norm = row.station.trim().toUpperCase();
                                    if (seenStations.has(norm)) return;
                                    seenStations.add(norm);

                                    const cat = getCategory(row.station);
                                    if (!categorizedRows[cat]) categorizedRows[cat] = [];
                                    categorizedRows[cat].push(row);
                                });

                                const sortStations = (a: any, b: any) => {
                                    const sta = a.station.toUpperCase();
                                    const stb = b.station.toUpperCase();
                                    const isJollyA = sta.includes('JOLLY');
                                    const isJollyB = stb.includes('JOLLY');
                                    if (isJollyA && !isJollyB) return -1;
                                    if (!isJollyA && isJollyB) return 1;
                                    return sta.localeCompare(stb);
                                };

                                categorizedRows['SALA BAR'].sort(sortStations);
                                categorizedRows['CUCINA'].sort(sortStations);

                                const groups = ['SALA BAR', 'CUCINA'];

                                const reservationData = INTERVALS.map((t, i) => {
                                    const h = parseInt(t.split(':')[0]);
                                    let val = 0;
                                    if (h >= 12 && h <= 15) val = 40 + Math.random() * 100;
                                    if (h >= 19 && h <= 22) val = 80 + Math.random() * 150;
                                    return Math.floor(val);
                                });

                                const getHeatColor = (val: number) => {
                                    if (val === 0) return 'bg-white';
                                    if (val <= 60) return 'bg-emerald-50 text-emerald-700';
                                    if (val <= 120) return 'bg-yellow-50 text-yellow-700';
                                    if (val <= 180) return 'bg-orange-50 text-orange-800';
                                    return 'bg-red-50 text-red-900 font-bold';
                                };

                                let totalRowCounter = 0;

                                return (
                                    <>
                                        {/* Reservation Flow Row */}
                                        <tr className="border-b border-gray-200">
                                            <td className="p-2 font-bold text-gray-500 sticky left-0 bg-white z-10 text-[10px] uppercase tracking-wider border-r">
                                                Flusso Prenotazioni (Simulato)
                                            </td>
                                            {INTERVALS.map((t, i) => {
                                                const val = reservationData[i];
                                                const isSplit = t === '15:45';
                                                return (
                                                    <td
                                                        key={`res-${i}`}
                                                        className={`border-r border-gray-100 text-center text-[9px] p-0 ${getHeatColor(val)} ${isSplit ? 'border-r-4 border-r-gray-300' : ''}`}
                                                        title={`${val} coperti`}
                                                    >
                                                        {val > 0 ? val : ''}
                                                    </td>
                                                );
                                            })}
                                            <td colSpan={4} className="bg-gray-50"></td>
                                        </tr>

                                        {groups.map(groupName => (
                                            <React.Fragment key={groupName}>
                                                <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-y border-gray-200">
                                                    <td className="p-2 font-bold text-gray-700 sticky left-0 bg-gray-100 z-10 text-[11px] uppercase tracking-wider flex items-center gap-2" colSpan={1}>
                                                        {groupName === 'CUCINA' ? '🔪' : '🍽️'} {groupName}
                                                    </td>
                                                    {INTERVALS.map(t => (
                                                        <td key={`h-${t}`} className={`bg-gray-50/50 ${t === '15:45' ? 'border-r-4 border-r-gray-300' : ''}`}></td>
                                                    ))}
                                                    <td colSpan={4} className="bg-gray-50"></td>
                                                </tr>

                                                {categorizedRows[groupName].map((row, idx) => {
                                                    const currentRowGlobalIdx = totalRowCounter++;
                                                    return (
                                                        <tr key={`${groupName}-${idx}`} className="hover:bg-gray-50 border-b border-gray-100 group transition-colors">
                                                            <td className="p-1 border-r font-medium text-gray-600 bg-white group-hover:bg-gray-50 sticky left-0 z-10 truncate text-[11px] h-8 pl-4 border-l-4 border-l-transparent hover:border-l-indigo-500 transition-all">
                                                                {row.station}
                                                            </td>

                                                            {row.cells.map((cell: any, cIdx: number) => {
                                                                let bg = '';
                                                                let text = '';
                                                                const val = cell.status;
                                                                const getInitials = (name: string) => {
                                                                    if (!name) return '';
                                                                    const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
                                                                    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                                                                    return name.substring(0, 2).toUpperCase();
                                                                };

                                                                if (val === 3) { bg = 'bg-emerald-200 text-emerald-900 font-semibold shadow-inner'; text = getInitials(cell.staff); }
                                                                else if (val === 1) { bg = 'bg-rose-50 text-rose-700 font-bold'; text = 'REQ'; }
                                                                else if (val === 2) { bg = 'bg-sky-100 text-sky-800 font-medium'; text = getInitials(cell.staff) || '+'; }

                                                                const isSplit = INTERVALS[cIdx] === '15:45';
                                                                let isHandover = false;
                                                                if (cIdx > 0) {
                                                                    const prev = row.cells[cIdx - 1];
                                                                    const isPrevCovered = prev.status === 2 || prev.status === 3;
                                                                    const isCurrCovered = val === 2 || val === 3;
                                                                    if (isPrevCovered && isCurrCovered && prev.staff !== cell.staff) isHandover = true;
                                                                }

                                                                let borderClass = 'border-r border-gray-100';
                                                                if (isSplit) borderClass = 'border-r-4 border-r-gray-300';
                                                                if (isHandover) borderClass = 'border-l-4 border-l-purple-500 border-r border-gray-100';
                                                                if (isSplit && isHandover) borderClass = 'border-l-4 border-l-purple-500 border-r-4 border-r-gray-300';

                                                                const assignmentId = cell.assignmentId;
                                                                const cellId = `cell-${currentRowGlobalIdx}-${cIdx}`;

                                                                return (
                                                                    <td
                                                                        key={cIdx}
                                                                        id={cellId}
                                                                        tabIndex={0}
                                                                        className={`${borderClass} text-center text-[9px] p-0 ${bg} cursor-pointer hover:brightness-95 transition focus:ring-2 focus:ring-indigo-500 focus:z-30 outline-none select-none`}
                                                                        title={cell.staff || 'Clicca per assegnare'}
                                                                        onClick={() => handleCellClick(row.station, INTERVALS[cIdx], assignmentId, cell.staff)}
                                                                        onKeyDown={(e) => handleGridKeyDown(e, currentRowGlobalIdx, cIdx)}
                                                                    >
                                                                        {text}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="p-1 border-r font-bold bg-yellow-50 text-center text-yellow-700 text-[10px]">{row.totalReqLunch.toFixed(2)}</td>
                                                            <td className="p-1 border-r font-bold bg-green-50 text-center text-green-700 text-[10px]">{row.totalCovLunch.toFixed(2)}</td>
                                                            <td className="p-1 border-r font-bold bg-orange-50 text-center text-orange-700 text-[10px]">{row.totalReqDinner.toFixed(2)}</td>
                                                            <td className="p-1 border-r font-bold bg-blue-50 text-center text-blue-700 text-[10px]">{row.totalCovDinner.toFixed(2)}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </React.Fragment>
                                        ))}
                                    </>
                                );
                            })()}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-200">
                                <td className="p-2 border-r text-right sticky left-0 bg-gray-100 z-10 text-gray-700">TOTALE</td>
                                {colTotalsReq.map((tot, i) => (
                                    <td key={i} className={`border-r text-center text-[7px] ${tot > 0 ? 'bg-indigo-100 text-indigo-800' : 'text-gray-300'} ${INTERVALS[i] === '15:45' ? 'border-r-4 border-r-gray-300' : ''}`}>
                                        {tot > 0 ? tot.toFixed(2).replace('.', ',') : '-'}
                                    </td>
                                ))}
                                <td className="p-1 border-r bg-yellow-100 text-center text-[9px] text-yellow-900">{gridRows.reduce((s, r) => s + r.totalReqLunch, 0).toFixed(2)}</td>
                                <td className="p-1 border-r bg-green-100 text-center text-[9px] text-green-900">{gridRows.reduce((s, r) => s + r.totalCovLunch, 0).toFixed(2)}</td>
                                <td className="p-1 border-r bg-orange-100 text-center text-[9px] text-orange-900">{gridRows.reduce((s, r) => s + r.totalReqDinner, 0).toFixed(2)}</td>
                                <td className="p-1 border-r bg-blue-100 text-center text-[9px] text-blue-900">{gridRows.reduce((s, r) => s + r.totalCovDinner, 0).toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Assignment Modal */}
            {assignmentModal.isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            // If user is in a dropdown or other special input, SearchableSelect's stopPropagation handles it.
                            // Here we just save.
                            handleSaveAssignment();
                        }
                    }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-[400px] animate-in fade-in zoom-in duration-200 ring-1 ring-black/5">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 relative rounded-t-2xl">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {assignmentModal.currentAssignmentId ? '✏️ Modifica Assegnamento' : '✨ Nuova Assegnazione'}
                            </h3>
                            <button onClick={() => { setAssignmentModal({ ...assignmentModal, isOpen: false }); if (lastFocusedCell.current) lastFocusedCell.current.focus(); }} className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1 transition">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* ... Content ... */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Postazione</div>
                                    <div className="font-bold text-gray-800 text-lg leading-tight">{assignmentModal.station}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data</div>
                                    <div className="font-medium text-gray-600 text-sm">{assignmentModal.date}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Inizio</label>
                                    <input
                                        type="time"
                                        value={assignmentModal.timeStart}
                                        onChange={e => setAssignmentModal({ ...assignmentModal, timeStart: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Fine</label>
                                    <input
                                        type="time"
                                        value={assignmentModal.timeEnd}
                                        onChange={e => setAssignmentModal({ ...assignmentModal, timeEnd: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1 relative">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Dipendente</label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={showAllStaff}
                                                onChange={(e) => setShowAllStaff(e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-600 transition-colors uppercase tracking-wide">
                                            Mostra tutti
                                        </span>
                                    </label>
                                </div>
                                <SearchableSelect
                                    options={staffList.filter((s: any) => {
                                        if (showAllStaff) return true; // Show everyone if forced

                                        // Filter out staff who already have an assignment on this day
                                        const hasAssignmentOnDate = assignments.some(asn => {
                                            if (asn.staffId !== s.id) return false;
                                            if (asn.data !== assignmentModal.date) return false;
                                            if (asn.id === assignmentModal.currentAssignmentId) return false; // Ignore self if editing
                                            return true; // Any assignment on this date excludes them
                                        });
                                        return !hasAssignmentOnDate;
                                    }).map((s: any) => {
                                        const hours = getStaffWeeklyHours(s.id);
                                        const max = s.oreMassime || 40;

                                        // Check if they are busy on this day (for visual feedback when forcing)
                                        const isBusy = assignments.some(asn =>
                                            asn.staffId === s.id &&
                                            asn.data === assignmentModal.date &&
                                            asn.id !== assignmentModal.currentAssignmentId
                                        );

                                        let label = `${s.nome} ${s.cognome} (${hours}h / ${max}h)`;
                                        if (isBusy) label = `⚠️ ${label} (Occupato)`;

                                        return {
                                            value: s.id,
                                            label
                                        };
                                    })}
                                    value={assignmentModal.staffId || ''}
                                    onChange={(val) => setAssignmentModal({ ...assignmentModal, staffId: Number(val) })}
                                    placeholder="Seleziona dipendente..."
                                    className="w-full"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                                {assignmentModal.currentAssignmentId && (
                                    <button
                                        onClick={handleDeleteAssignment}
                                        className="mr-auto text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
                                        title="Elimina"
                                    >
                                        <Trash2 size={16} /> Elimina
                                    </button>
                                )}
                                <button
                                    onClick={() => { setAssignmentModal({ ...assignmentModal, isOpen: false }); if (lastFocusedCell.current) lastFocusedCell.current.focus(); }}
                                    className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-bold text-sm transition-colors"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={handleSaveAssignment}
                                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold text-sm hover:shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:-translate-y-0.5"
                                >
                                    Salva Assegnazione
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CoverageDetailsPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Caricamento...</div>}>
            <CoverageDetailsContent />
        </Suspense>
    );
}
