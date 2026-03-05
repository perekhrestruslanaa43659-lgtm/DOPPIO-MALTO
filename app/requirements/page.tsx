'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Save, Plus, Trash2, ChevronLeft, ChevronRight, X, Upload, BarChart, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import StaffSelectionModal from '@/components/StaffSelectionModal';
import { DEFAULT_STATIONS } from '@/lib/constants';

// --- Types ---
interface CoverageRow {
    station: string;
    frequency?: string;
    // We store data in a structured way: slots[date] = { lIn, lOut, dIn, dOut }
    slots: Record<string, { lIn: string, lOut: string, dIn: string, dOut: string }>;
    extra: Record<string, any>; // contains { active: boolean }
}

// --- Helpers ---
function getWeekRange(w: number, year: number) {
    const d = new Date(Date.UTC(year, 0, 4));
    const day = d.getUTCDay() || 7;
    const startOfYear = new Date(d);
    startOfYear.setUTCDate(d.getUTCDate() - day + 1);

    const startD = new Date(startOfYear);
    startD.setUTCDate(startOfYear.getUTCDate() + (w - 1) * 7);
    const start = startD.toISOString().slice(0, 10);

    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const end = endD.toISOString().slice(0, 10);

    return { start, end };
}

function getWeekNumber(d: Date) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((Number(d) - Number(yearStart)) / 86400000) + 1) / 7);
}

function getDatesInRange(startDate: string, endDate: string) {
    const dates = [];
    let curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

function calcHours(start: string, end: string) {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    let diff = (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60);
    if (diff < 0) diff += 24;
    return diff;
}

import { Suspense } from 'react';
\n    const searchParams = useSearchParams();

// Init state with defaults but will be overridden by effect
const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
const [week, setWeek] = useState(getWeekNumber(new Date()));
const [range, setRange] = useState(getWeekRange(getWeekNumber(new Date()), new Date().getFullYear()));
const [isInitialized, setIsInitialized] = useState(false); // Guard

const [rows, setRows] = useState<CoverageRow[]>([]);
const [budgetHours, setBudgetHours] = useState<Record<string, number>>({});
const [budgetLunchHours, setBudgetLunchHours] = useState<Record<string, number>>({});
const [budgetDinnerHours, setBudgetDinnerHours] = useState<Record<string, number>>({});
const [assignedLunchHours, setAssignedLunchHours] = useState<Record<string, number>>({});
const [assignedDinnerHours, setAssignedDinnerHours] = useState<Record<string, number>>({});
const [loading, setLoading] = useState(false);

// Staff assignment state
const [staff, setStaff] = useState<any[]>([]);
const [assignments, setAssignments] = useState<any[]>([]);
const [modalOpen, setModalOpen] = useState(false);
const [modalContext, setModalContext] = useState<{
    date: string;
    postazione: string;
    shift: 'lunch' | 'dinner';
    orari: { start: string; end: string };
} | null>(null);

const days = getDatesInRange(range.start, range.end);
const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

\n
// Load Persistence
useEffect(() => {
    const pYear = searchParams.get('year');
    const pWeek = searchParams.get('week');
    const savedWeek = localStorage.getItem('calendar_week');
    const savedYear = localStorage.getItem('calendar_year');

    let targetYear = currentYear;
    let targetWeek = week;

    if (pYear) targetYear = parseInt(pYear);
    else if (savedYear) targetYear = parseInt(savedYear);

    if (pWeek) targetWeek = parseInt(pWeek);
    else if (savedWeek) targetWeek = parseInt(savedWeek);

    setCurrentYear(targetYear);
    setWeek(targetWeek);
    setRange(getWeekRange(targetWeek, targetYear));
    setIsInitialized(true);
}, [searchParams]);

// Save Persistence
useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('calendar_week', week.toString());
    localStorage.setItem('calendar_year', currentYear.toString());
    // Also update range when week/year changes
    setRange(getWeekRange(week, currentYear));
    // loadData will trigger via [range] dependency
}, [week, currentYear, isInitialized]);

useEffect(() => {
    if (isInitialized) loadData();
}, [range, isInitialized]);

const changeWeek = (w: number) => {
    setWeek(w);
    setRange(getWeekRange(w, currentYear));
};

// --- Staff Assignment Functions ---
const openAssignModal = (date: string, postazione: string, shift: 'lunch' | 'dinner', orari: { start: string; end: string }) => {
    setModalContext({ date, postazione, shift, orari });
    setModalOpen(true);
};

const handleStaffSelect = async (staffId: number) => {
    if (!modalContext) return;

    try {
        const { date, postazione, orari } = modalContext;

        // Create assignment via API
        await api.createAssignment({
            data: date,
            staffId,
            start_time: orari.start,
            end_time: orari.end,
            postazione,
            status: false
        });

        // Reload data to refresh assignments
        await loadData();
        setModalOpen(false);
        setModalContext(null);
    } catch (error) {
        console.error('Error assigning staff:', error);
        alert('Errore durante l\'assegnazione del turno');
    }
};

const removeAssignment = async (assignmentId: number) => {
    if (!confirm('Rimuovere questo turno?')) return;

    try {
        await api.deleteAssignment(assignmentId);
        await loadData();
    } catch (error) {
        console.error('Error removing assignment:', error);
        alert('Errore durante la rimozione del turno');
    }
};

// --- API ---
const loadData = async () => {
    setLoading(true);
    try {
        // Load Requirements
        const reqProm = fetch(`/api/requirements?date=${range.start}`).then(r => r.json());
        // Load Budget hours from Budget API (not Forecast)
        const budgetProm = api.getBudget(range.start, range.end);
        // Load Assignments to calculate assigned hours
        const assignProm = api.getSchedule(range.start, range.end);
        // Load Staff for names
        const staffProm = api.getStaff();

        const [data, budgetData, assignments, staffList] = await Promise.all([reqProm, budgetProm, assignProm, staffProm]);

        // Store staff list
        setStaff(Array.isArray(staffList) ? staffList : []);
        setAssignments(Array.isArray(assignments) ? assignments : []);

        // 1. Setup Rows
        let loadedRows: CoverageRow[] = [];
        if (Array.isArray(data) && data.length > 0) {
            loadedRows = data.map((r: any) => ({
                station: r.station,
                frequency: r.frequency,
                slots: typeof r.slots === 'string' ? JSON.parse(r.slots) : r.slots,
                extra: typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra
            }));
        }

        if (loadedRows.length === 0) {
            loadedRows = DEFAULT_STATIONS.map(station => ({
                station,
                frequency: '',
                slots: {},
                extra: { active: true } // Default active
            }));
        }

        setRows(loadedRows);

        // 2. Parse Budget Hours from Budget API
        const bHours: Record<string, number> = {};
        const bLunchHours: Record<string, number> = {};
        const bDinnerHours: Record<string, number> = {};

        if (Array.isArray(budgetData)) {
            budgetData.forEach((b: any) => {
                // Budget API returns { data: 'YYYY-MM-DD', hoursLunch: number, hoursDinner: number }
                if (b.data) {
                    const lunchHours = parseFloat(b.hoursLunch) || 0;
                    const dinnerHours = parseFloat(b.hoursDinner) || 0;
                    bLunchHours[b.data] = lunchHours;
                    bDinnerHours[b.data] = dinnerHours;
                    bHours[b.data] = lunchHours + dinnerHours;
                }
            });
        }
        console.log('📊 Budget hours loaded:', { total: bHours, lunch: bLunchHours, dinner: bDinnerHours });
        setBudgetHours(bHours);
        setBudgetLunchHours(bLunchHours);
        setBudgetDinnerHours(bDinnerHours);

        // 3. Calculate Assigned Hours from Assignments (split by lunch/dinner at 16:00)
        const assignedLunch: Record<string, number> = {};
        const assignedDinner: Record<string, number> = {};

        days.forEach(d => {
            assignedLunch[d] = 0;
            assignedDinner[d] = 0;
        });

        if (Array.isArray(assignments)) {
            assignments.forEach((a: any) => {
                const date = a.data;
                if (!days.includes(date)) return;

                const st = a.start_time || a.shiftTemplate?.oraInizio;
                const et = a.end_time || a.shiftTemplate?.oraFine;
                if (!st || !et) return;

                // Parse times
                const parseTime = (timeStr: string) => {
                    const cleaned = timeStr.trim().split(' ')[0];
                    const parts = cleaned.split(':');
                    if (parts.length !== 2) return null;
                    const h = parseInt(parts[0]);
                    const m = parseInt(parts[1]);
                    if (isNaN(h) || isNaN(m)) return null;
                    return h + m / 60;
                };

                const starts = parseTime(st);
                const ends = parseTime(et);
                if (starts === null || ends === null) return;

                let endsAdjusted = ends;
                if (ends < starts) endsAdjusted = ends + 24; // Handle overnight

                const cutoff = 16.0; // 16:00 cutoff for lunch/dinner

                // Calculate lunch hours (before 16:00)
                const lunchEnd = Math.min(endsAdjusted, cutoff);
                const lunchHours = Math.max(0, lunchEnd - starts);
                assignedLunch[date] += lunchHours;

                // Calculate dinner hours (after 16:00)
                const dinnerStart = Math.max(starts, cutoff);
                const dinnerHours = Math.max(0, endsAdjusted - dinnerStart);
                assignedDinner[date] += dinnerHours;
            });
        }

        // Store in state (need to add these state variables)
        setAssignedLunchHours(assignedLunch);
        setAssignedDinnerHours(assignedDinner);

    } catch (e: any) {
        console.error(e);
    } finally {
        setLoading(false);
    }
};

const handleSave = async () => {
    setLoading(true);
    try {
        const res = await fetch('/api/requirements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekStart: range.start, rows })
        });
        if (res.ok) alert("✅ Dati salvati con successo!");
        else throw new Error("Errore salvataggio");
    } catch (e: any) {
        alert(e.message);
    } finally {
        setLoading(false);
    }
};

const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const wb = XLSX.read(evt.target?.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            const newRows: CoverageRow[] = [];

            for (let i = 0; i < json.length; i++) {
                const row = json[i];
                const station = String(row[0] || '').trim();
                if (!station || station === 'undefined' || station.startsWith(',')) continue;

                const slots: Record<string, any> = {};

                days.forEach((day, dIdx) => {
                    const base = 2 + (dIdx * 4);

                    const lIn = row[base] ? String(row[base]).trim() : '';
                    const lOut = row[base + 1] ? String(row[base + 1]).trim() : '';
                    const dIn = row[base + 2] ? String(row[base + 2]).trim() : '';
                    const dOut = row[base + 3] ? String(row[base + 3]).trim() : '';

                    const norm = (t: string) => t.replace('.', ':').replace('!', '1');

                    slots[day] = {
                        lIn: norm(lIn),
                        lOut: norm(lOut),
                        dIn: norm(dIn),
                        dOut: norm(dOut)
                    };
                });

                newRows.push({ station, frequency: '', slots, extra: { active: true } });
            }

            if (newRows.length > 0) {
                setRows(newRows);
                alert("Importazione completata!");
            } else {
                alert("Nessuna riga valida trovata.");
            }

        } catch (ex: any) {
            alert("Errore import: " + ex.message);
        }
    };
    reader.readAsBinaryString(file);
};

const updateSlot = (rIdx: number, date: string, field: 'lIn' | 'lOut' | 'dIn' | 'dOut', val: string) => {
    const nr = [...rows];
    if (!nr[rIdx].slots[date]) nr[rIdx].slots[date] = { lIn: '', lOut: '', dIn: '', dOut: '' };
    nr[rIdx].slots[date][field] = val;
    setRows(nr);
};

const addRow = () => {
    setRows([...rows, { station: 'NUOVA POSTAZIONE', frequency: '', slots: {}, extra: { active: true } }]);
};

const removeRow = (idx: number) => {
    if (confirm('Eliminare riga definitivamentee?')) {
        const nr = [...rows];
        nr.splice(idx, 1);
        setRows(nr);
    }
};

const toggleActive = (idx: number) => {
    const nr = [...rows];
    const current = nr[idx].extra?.active !== false;
    nr[idx].extra = { ...nr[idx].extra, active: !current };
    setRows(nr);
};

const updateCell = (idx: number, field: string, date: string, val: string) => {
    const nr = [...rows];
    if (field === 'station') nr[idx].station = val;
    setRows(nr);
};

// --- Calculations ---
const dailyLunchTotals = days.map(d => {
    let sum = 0;
    rows.forEach(r => {
        if (r.extra?.active === false) return;
        const s = r.slots[d];
        if (s) sum += calcHours(s.lIn, s.lOut);
    });
    return sum;
});

const dailyDinnerTotals = days.map(d => {
    let sum = 0;
    rows.forEach(r => {
        if (r.extra?.active === false) return;
        const s = r.slots[d];
        if (s) sum += calcHours(s.dIn, s.dOut);
    });
    return sum;
});

const dailyTotals = days.map((_, i) => dailyLunchTotals[i] + dailyDinnerTotals[i]);

\n
return (
    <div className="max-w-full mx-auto p-4 bg-gray-50 min-h-screen">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm gap-4">
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                    <BarChart className="text-indigo-600" />
                    Fabbisogno Orario
                </h1>
            </div>

            <div className="flex gap-4 items-center">
                <div className="flex flex-col px-2 bg-gray-50 rounded">
                    <span className="text-[10px] uppercase text-gray-500 font-bold">Anno</span>
                    <input
                        type="number"
                        className="bg-transparent font-bold w-16 text-sm outline-none"
                        value={currentYear}
                        onChange={(e) => {
                            const y = parseInt(e.target.value) || 2025;
                            setCurrentYear(y);
                            // range effect will handle update
                        }}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-700">Week:</span>
                    <select className="p-2 border rounded-lg bg-gray-50 font-medium text-sm" value={week} onChange={e => setWeek(Number(e.target.value))}>
                        {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                            <option key={w} value={w}>{w}</option>
                        ))}
                    </select>
                    <span className="text-xs text-gray-500">({range.start})</span>
                </div>

                <Link href={`/requirements/details?year=${currentYear}&week=${week}`} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-bold shadow-md animate-pulse">
                    <LayoutGrid size={18} /> DETTAGLIO GIORNALIERO
                </Link>
                \n                </div >
        </div >

        <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-600 text-indigo-600 rounded hover:bg-indigo-50 transition text-sm font-medium cursor-pointer shadow-sm">
                <Upload size={16} /> Importa CSV
                <input type="file" className="hidden" onChange={handleImport} accept=".csv, .xlsx, .xls" />
            </label>
            <button onClick={handleSave} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-medium shadow-sm">
                <Save size={16} /> Salva
            </button>
            <button onClick={addRow} className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition text-sm font-medium shadow-sm">
                + Riga
            </button>
        </div>
        \n\n    {
            modalContext && (
                <StaffSelectionModal
                    isOpen={modalOpen}
                    onClose={() => {
                        setModalOpen(false);
                        setModalContext(null);
                    }}
                    onSelect={handleStaffSelect}
                    date={modalContext.date}
                    postazione={modalContext.postazione}
                    shift={modalContext.shift}
                    orari={modalContext.orari}
                    staff={staff}
                    existingAssignments={assignments}
                />
            )
        }
    </div >
);
}

export default function RequirementsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Caricamento...</div>}>
            <RequirementsContent />
        </Suspense>
    );
}
