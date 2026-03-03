'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Save, Plus, Trash2, ChevronLeft, ChevronRight, X, Upload, BarChart, Eye, EyeOff, LayoutGrid, Sparkles, Zap, Calendar } from 'lucide-react';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDraggable,
    useDroppable,
    DragOverlay
} from '@dnd-kit/core';
import { ContextMenu } from '@/components/ShiftContextMenu';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import StaffSelectionModal from '@/components/StaffSelectionModal';
import { DEFAULT_STATIONS } from '@/lib/constants';
import { getDatesInRange, getWeekNumber, getWeekRange } from '@/lib/date-utils';

// --- Helpers ---
const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
};
const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

// --- Types ---
interface CoverageRow {
    id: string; // Unique UI ID
    station: string;
    frequency?: string;
    slots: Record<string, { lIn: string, lOut: string, dIn: string, dOut: string }>;
    extra: Record<string, any>; // contains { active: boolean }
}

const genId = () => Math.random().toString(36).substr(2, 9);

const isCucina = (name: string) => {
    const n = name.toUpperCase();
    // Removed 'JOLLY' to avoid matching 'JOLLY SALA'. 'JOLLY CUCINA' matches via 'CUCINA'.
    const keywords = ['FRITTI', 'DOLCI', 'PREPARAZIONE', 'LAVAGGIO', 'GRIGLIA', 'CUCINA', 'PIRA', 'BURGER', 'PLONGE', 'CUOCO', 'CHEF', 'PULIZIA CUCINA'];
    return keywords.some(k => n.includes(k));
};

const calcHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    if (isNaN(h1) || isNaN(h2)) return 0;
    let diff = (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60);
    if (diff < 0) diff += 24;
    return diff;
};

// --- Main Content Component ---
const RequirementsContent = () => {
    const searchParams = useSearchParams();

    // State
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [week, setWeek] = useState<number>(1);
    const [weekInput, setWeekInput] = useState<string>('1');
    const [rows, setRows] = useState<CoverageRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState({ start: '', end: '' });
    const [days, setDays] = useState<string[]>([]);

    // Budget & Assignments State
    const [budgetHours, setBudgetHours] = useState<Record<string, number>>({});
    const [budgetLunchHours, setBudgetLunchHours] = useState<Record<string, number>>({});
    const [budgetDinnerHours, setBudgetDinnerHours] = useState<Record<string, number>>({});
    const [budgetLunchKitchen, setBudgetLunchKitchen] = useState<Record<string, number>>({});
    const [budgetDinnerKitchen, setBudgetDinnerKitchen] = useState<Record<string, number>>({});
    const [budgetLunchHall, setBudgetLunchHall] = useState<Record<string, number>>({});
    const [budgetDinnerHall, setBudgetDinnerHall] = useState<Record<string, number>>({});
    const [budgetRevenue, setBudgetRevenue] = useState<Record<string, number>>({}); // Daily Revenue Budget
    const [assignments, setAssignments] = useState<any[]>([]);
    const [assignedLunchHours, setAssignedLunchHours] = useState<Record<string, number>>({});
    const [assignedDinnerHours, setAssignedDinnerHours] = useState<Record<string, number>>({});
    const [staff, setStaff] = useState<any[]>([]);

    // [INNOVATION] Cost Estimation State
    const [avgHourlyRate, setAvgHourlyRate] = useState(15); // Default fallback
    const [costOverride, setCostOverride] = useState<number | null>(null); // Allow manual override

    const [showHidden, setShowHidden] = useState(false);

    // Initial Load logic...
    useEffect(() => {
        const qYear = searchParams.get('year');
        const qWeek = searchParams.get('week');
        if (qYear) setCurrentYear(parseInt(qYear));
        if (qWeek) setWeek(parseInt(qWeek));
        else {
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 1);
            const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
            setWeek(Math.ceil(days / 7));
        }
    }, [searchParams]);

    // Sync week -> weekInput
    useEffect(() => {
        setWeekInput(week.toString());
    }, [week]);

    // Update Range...
    useEffect(() => {
        const { start, end } = getWeekRange(week, currentYear);
        setRange({ start, end });

        const d = getDatesInRange(start, end);
        setDays(d);
    }, [week, currentYear]);

    // Load Data...
    useEffect(() => {
        if (!range.start) return;
        loadData();
    }, [range]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [coverageData, budgetData, scheduleData, staffData] = await Promise.all([
                api.getCoverage(range.start),
                api.getBudget(range.start, range.end),
                api.getSchedule(range.start, range.end),
                api.getStaff()
            ]);

            // 1. Coverage Rows
            let loadedRows: CoverageRow[] = [];
            if (Array.isArray(coverageData) && coverageData.length > 0) {
                loadedRows = coverageData.map((r: any) => ({
                    id: genId(),
                    station: r.station,
                    frequency: r.frequency,
                    slots: typeof r.slots === 'string' ? JSON.parse(r.slots) : r.slots,
                    extra: typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra
                }));
            } else {
                loadedRows = DEFAULT_STATIONS.map(station => ({
                    id: genId(),
                    station,
                    frequency: '',
                    slots: {},
                    extra: { active: true }
                }));
            }

            // Dedupe & Sort logic here...
            const seen = new Set<string>();
            loadedRows = loadedRows.filter(r => {
                const k = r.station.trim().toUpperCase();
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });

            // Priorities
            loadedRows.sort((a, b) => {
                const catA = isCucina(a.station) ? 1 : 0;
                const catB = isCucina(b.station) ? 1 : 0;
                if (catA !== catB) return catA - catB;
                const isJollyA = a.station.toUpperCase().includes('JOLLY');
                const isJollyB = b.station.toUpperCase().includes('JOLLY');
                if (isJollyA && !isJollyB) return -1;
                if (!isJollyA && isJollyB) return 1;
                return a.station.localeCompare(b.station);
            });

            setRows(loadedRows);
            justLoaded.current = true;

            // 2. Budget & Forecast Integration
            const bHours: Record<string, number> = {};
            const bLunch: Record<string, number> = {};
            const bDinner: Record<string, number> = {};
            const bLunchKitchen: Record<string, number> = {};
            const bDinnerKitchen: Record<string, number> = {};
            const bLunchHall: Record<string, number> = {};
            const bDinnerHall: Record<string, number> = {};
            const bRevenue: Record<string, number> = {};

            // First, load from Budget DB
            if (Array.isArray(budgetData)) {
                budgetData.forEach((b: any) => {
                    const dKey = b.data.split('T')[0];
                    if (dKey) {
                        const l = parseFloat(b.hoursLunch) || 0;
                        const d = parseFloat(b.hoursDinner) || 0;

                        // New Breakdown
                        bLunchKitchen[dKey] = parseFloat(b.hoursLunchKitchen) || 0;
                        bDinnerKitchen[dKey] = parseFloat(b.hoursDinnerKitchen) || 0;
                        bLunchHall[dKey] = parseFloat(b.hoursLunchHall) || 0;
                        bDinnerHall[dKey] = parseFloat(b.hoursDinnerHall) || 0;

                        bLunch[dKey] = l;
                        bDinner[dKey] = d;
                        bHours[dKey] = l + d;
                        bRevenue[dKey] = (parseFloat(b.valueLunch) || 0) + (parseFloat(b.valueDinner) || 0);
                    }
                });
            }

            setBudgetHours(bHours);
            setBudgetLunchHours(bLunch);
            setBudgetDinnerHours(bDinner);
            setBudgetLunchKitchen(bLunchKitchen);
            setBudgetDinnerKitchen(bDinnerKitchen);
            setBudgetLunchHall(bLunchHall);
            setBudgetDinnerHall(bDinnerHall);
            setBudgetRevenue(bRevenue);

            // 3. Assignments & Staff
            const normalizedSchedule = (scheduleData || []).map((a: any) => {
                let dKey = a.data;
                if (a.data && a.data.includes('T')) {
                    const d = new Date(a.data);
                    dKey = d.toLocaleDateString('fr-CA'); // YYYY-MM-DD
                    if (dKey === 'Invalid Date') dKey = a.data.split('T')[0];
                }
                return { ...a, data: dKey };
            });

            setAssignments(normalizedSchedule);
            setStaff(staffData || []);

            // Calculate Avg Hourly Rate
            if (Array.isArray(staffData) && staffData.length > 0) {
                const totalRate = staffData.reduce((acc: number, s: any) => acc + (s.costoOra || 15), 0);
                setAvgHourlyRate(totalRate / staffData.length);
            }

            // Calc Assignment Totals logic...
            const assignedL: Record<string, number> = {};
            const assignedD: Record<string, number> = {};
            days.forEach(d => { assignedL[d] = 0; assignedD[d] = 0; });

            normalizedSchedule.forEach((a: any) => {
                if (!days.includes(a.data)) return;

                const st = a.start_time || a.shiftTemplate?.oraInizio;
                const et = a.end_time || a.shiftTemplate?.oraFine;
                if (st && et) {
                    const h = calcHours(st, et);
                    // Simplified Split
                    const [hStart] = st.split(':').map(Number);
                    if (hStart < 16) assignedL[a.data] = (assignedL[a.data] || 0) + h;
                    else assignedD[a.data] = (assignedD[a.data] || 0) + h;
                }
            });
            setAssignedLunchHours(assignedL);
            setAssignedDinnerHours(assignedD);

        } catch (e) { console.error("Error loading data", e); }
        finally { setLoading(false); }
    };

    // --- Totals ---
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

    const totalWeeklyHours = dailyLunchTotals.reduce((a, b) => a + b, 0) + dailyDinnerTotals.reduce((a, b) => a + b, 0);
    const effectiveRate = costOverride !== null ? costOverride : avgHourlyRate;
    const estimatedTotalCost = totalWeeklyHours * effectiveRate;

    // --- CSV Upload ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Get raw data (array of arrays)
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (!data || data.length < 5) {
                    throw new Error("Formato non valido: troppe poche righe.");
                }

                // 1. Find Date Row (Row 2, index 1)
                const dateRow = data[1]; // Row 2

                // Map Column Index -> Date String (YYYY-MM-DD)
                const colToDate: Record<number, string> = {};
                const foundDates = new Set<string>();

                dateRow.forEach((cell: any, colIdx: number) => {
                    let dStr = '';
                    if (typeof cell === 'number') {
                        // Excel serial date
                        const dObj = new Date(Math.round((cell - 25569) * 86400 * 1000));
                        dStr = formatDate(dObj);
                    } else if (typeof cell === 'string' && cell.includes('/')) {
                        // "13/10/2025"
                        const parts = cell.split('/');
                        if (parts.length === 3) dStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                    else if (typeof cell === 'string' && cell.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        dStr = cell;
                    }

                    if (dStr) {
                        colToDate[colIdx] = dStr;
                        foundDates.add(dStr);
                    }
                });

                if (foundDates.size === 0) {
                    throw new Error("Nessuna data trovata nella riga 2. Assicurati che il formato sia corretto (es: 13/10/2025).");
                }

                // Check mismatch
                const foundDateList = Array.from(foundDates).sort();
                const firstDate = foundDateList[0];
                const matchingDates = foundDateList.filter(d => days.includes(d));

                if (matchingDates.length === 0) {
                    // Detect Week and Year from firstDate
                    if (confirm(`⚠️ I dati nel file sembrano essere del ${firstDate} (fuori dalla settimana visualizzata).\n\nVuoi saltare alla settimana corretta e importare?`)) {
                        const targetDate = new Date(firstDate);
                        const targetYear = targetDate.getFullYear();

                        // Get ISO Week
                        const tempDate = new Date(Date.UTC(targetYear, targetDate.getMonth(), targetDate.getDate()));
                        tempDate.setUTCDate(tempDate.getUTCDate() + 4 - (tempDate.getUTCDay() || 7));
                        const yearStart = new Date(Date.UTC(targetYear, 0, 1));
                        const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

                        setCurrentYear(targetYear);
                        setWeek(weekNo);

                        // Calc new days locally as existing days state won't update in this render cycle
                        // Calc new days locally as existing days state won't update in this render cycle
                        const range = getWeekRange(weekNo, targetYear);
                        const newDays = getDatesInRange(range.start, range.end);

                        // DEEP CLONE for Safety
                        const rowsClone = JSON.parse(JSON.stringify(rows));
                        processRows(data, rowsClone, colToDate, newDays);
                        setRows(rowsClone);
                        return; // Done
                    } else {
                        return; // Cancelled
                    }
                }

                // Normal process (current week matches)
                const rowsClone = JSON.parse(JSON.stringify(rows));
                processRows(data, rowsClone, colToDate, days);
                setRows(rowsClone);
                alert(`Importazione completata!`);

            } catch (err: any) {
                console.error(err);
                alert("Errore lettura file: " + err.message);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const processRows = (data: any[][], newRows: CoverageRow[], colToDate: Record<number, string>, targetDays: string[]) => {
        let addedCount = 0;
        // 2. Iterate Data Rows (Row 5+, index 4+)
        for (let r = 4; r < data.length; r++) {
            const row = data[r];
            const stationName = row[0]; // Col A
            if (!stationName || typeof stationName !== 'string') continue;

            let targetRow = newRows.find(item => item.station.toUpperCase() === stationName.toUpperCase().trim());
            if (!targetRow) {
                targetRow = { id: genId(), station: stationName.trim(), slots: {}, extra: { active: true } };
                newRows.push(targetRow);
            }

            Object.keys(colToDate).forEach((key) => {
                const startCol = parseInt(key);
                const dateStr = colToDate[startCol];

                if (!targetDays.includes(dateStr)) return;

                const t1_in = row[startCol];
                const t1_out = row[startCol + 1];
                const t2_in = row[startCol + 2];
                const t2_out = row[startCol + 3];

                const fmtTime = (val: any) => {
                    if (!val) return '';
                    if (typeof val === 'number') {
                        const totalMins = Math.round(val * 24 * 60);
                        const h = Math.floor(totalMins / 60);
                        const m = totalMins % 60;
                        return `${h}:${m.toString().padStart(2, '0')}`;
                    }
                    return String(val).trim();
                };

                if (!targetRow!.slots[dateStr]) targetRow!.slots[dateStr] = { lIn: '', lOut: '', dIn: '', dOut: '' };
                const s = targetRow!.slots[dateStr];

                const p1_start = fmtTime(t1_in);
                const p1_end = fmtTime(t1_out);
                if (p1_start) {
                    const h = parseInt(p1_start.split(':')[0]);
                    if (h < 17) { s.lIn = p1_start; s.lOut = p1_end; }
                    else { s.dIn = p1_start; s.dOut = p1_end; }
                }

                const p2_start = fmtTime(t2_in);
                const p2_end = fmtTime(t2_out);
                if (p2_start) {
                    const h = parseInt(p2_start.split(':')[0]);
                    if (h < 17) {
                        s.lIn = p2_start; s.lOut = p2_end;
                    } else {
                        s.dIn = p2_start; s.dOut = p2_end;
                    }
                }

                if (p1_start || p2_start) addedCount++;
            });
        }
        return addedCount;
    };

    // --- [INNOVATION] SMART DISTRIBUTE ---
    const handleSmartDistribute = () => {
        if (!confirm('⚡ ATTENZIONE: Questo sovrascriverà gli orari attuali con una distribuzione automatica basata sul Budget. Continuare?')) return;

        saveHistory();
        const newRows = [...rows];

        days.forEach((date, dayIdx) => {
            const budgetL = budgetLunchHours[date] || 0;
            const budgetD = budgetDinnerHours[date] || 0;

            const activeRows = newRows.filter(r => r.extra?.active !== false);
            if (activeRows.length === 0) return;

            // Simple distribution: 
            // Lunch: 12:00 - X
            // Dinner: 19:00 - X
            // distribute budgetL hours across activeRows

            const hoursPerStationL = budgetL / activeRows.length;
            const hoursPerStationD = budgetD / activeRows.length;

            activeRows.forEach(row => {
                if (!row.slots[date]) row.slots[date] = { lIn: '', lOut: '', dIn: '', dOut: '' };

                // Set logic
                // Start Lunch 12:00. End = 12 + hours.
                if (hoursPerStationL > 0) {
                    row.slots[date].lIn = '12:00';
                    // Convert decimal hours to time
                    const endDec = 12 + hoursPerStationL;
                    const h = Math.floor(endDec);
                    const m = Math.round((endDec - h) * 60);
                    row.slots[date].lOut = `${h}:${m.toString().padStart(2, '0')}`;
                } else {
                    row.slots[date].lIn = ''; row.slots[date].lOut = '';
                }

                // Start Dinner 19:00
                if (hoursPerStationD > 0) {
                    row.slots[date].dIn = '19:00';
                    const endDec = 19 + hoursPerStationD;
                    const h = Math.floor(endDec);
                    const m = Math.round((endDec - h) * 60);
                    // Helper for post-midnight
                    const dH = h >= 24 ? h - 24 : h;
                    row.slots[date].dOut = `${dH}:${m.toString().padStart(2, '0')}`;
                } else {
                    row.slots[date].dIn = ''; row.slots[date].dOut = '';
                }
            });
        });

        setRows(newRows);
        alert('✨ Distribuzione completata!');
    };

    // [INNOVATION] Duplicate Previous Week
    const handleDuplicatePreviousWeek = async () => {
        if (!confirm('⚠️ ATTENZIONE: Questo sovrascriverà la copertura attuale con quella della settimana scorsa. Continuare?')) return;

        try {
            const prevDate = new Date(range.start);
            prevDate.setDate(prevDate.getDate() - 7);
            const prevDateStr = formatDate(prevDate);

            const prevData = await api.getCoverage(prevDateStr);

            if (!prevData || prevData.length === 0) {
                alert('Nessun dato trovato nella settimana precedente.');
                return;
            }

            // Map slots from prev week dates to current week dates
            // Assuming order is Mon-Sun
            const prevDays: string[] = [];
            const curr = new Date(prevDate);
            for (let i = 0; i < 7; i++) {
                prevDays.push(formatDate(curr));
                curr.setDate(curr.getDate() + 1);
            }

            const newRows = prevData.map((r: any) => {
                const newSlots: any = {};
                // Map each day from prev week to current week by index (0-6)
                prevDays.forEach((pDay, idx) => {
                    const cDay = days[idx];
                    if (r.slots && r.slots[pDay]) {
                        newSlots[cDay] = { ...r.slots[pDay] };
                    } else if (typeof r.slots === 'string') {
                        const parsed = JSON.parse(r.slots);
                        if (parsed[pDay]) newSlots[cDay] = { ...parsed[pDay] };
                    }
                });

                return {
                    id: genId(),
                    station: r.station,
                    frequency: r.frequency,
                    slots: newSlots,
                    extra: typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra
                };
            });

            saveHistory();
            setRows(newRows);
            alert('✅ Copia completata! Ricordati di salvare.');

        } catch (e: any) {
            console.error(e);
            alert("Errore durante la copia: " + e.message);
        }
    };


    // [INNOVATION] Auto-Save Logic
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const justLoaded = React.useRef(false);

    // Auto-save effect
    useEffect(() => {
        if (justLoaded.current) {
            justLoaded.current = false;
            return;
        }
        if (rows.length === 0) return;

        const timer = setTimeout(() => {
            handleSave(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, [rows]);

    // ... Standard Actions (Save, Import, etc) ...
    const handleSave = async (silent = false) => {
        const validation = rows.map(r => r.station.trim().toUpperCase());
        const duplicates = validation.filter((item, index) => validation.indexOf(item) !== index);
        if (duplicates.length > 0) {
            if (!silent) alert("Nomi postazione duplicati!");
            return;
        }

        setSaveStatus('saving');
        try {
            await api.saveCoverage({ weekStart: range.start, rows });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
            if (!silent) alert("✅ Salvato!");
        } catch (e: any) {
            setSaveStatus('error');
            console.error(e);
            if (!silent) alert(e.message);
        }
    };

    const addRow = () => {
        saveHistory();
        setRows(prev => [...prev, { id: genId(), station: 'NUOVA ' + (prev.length + 1), slots: {}, extra: { active: true } }]);
    };
    const removeRow = (idx: number) => {
        if (confirm('Eliminare?')) {
            saveHistory();
            setRows(prev => {
                const nr = [...prev];
                nr.splice(idx, 1);
                return nr;
            });
        }
    };
    const updateCell = (idx: number, f: string, d: string, v: string) => {
        setRows(prev => {
            const nr = [...prev];
            // shallow copy the row being modified
            nr[idx] = { ...nr[idx] };
            if (f === 'station') nr[idx].station = v;
            return nr;
        });
    };
    const updateSlot = (rIdx: number, d: string, f: any, v: string) => {
        setRows(prev => {
            // Deep clone to be safe with nested objects or use careful spreading
            // We only need to clone the path we touch.
            const nr = [...prev];
            nr[rIdx] = { ...nr[rIdx], slots: { ...nr[rIdx].slots } };
            if (!nr[rIdx].slots[d]) nr[rIdx].slots[d] = { lIn: '', lOut: '', dIn: '', dOut: '' };
            nr[rIdx].slots[d] = { ...nr[rIdx].slots[d], [f]: v };
            return nr;
        });
    };
    const toggleActive = (idx: number) => {
        saveHistory();
        setRows(prev => {
            const nr = [...prev];
            nr[idx] = { ...nr[idx], extra: { ...nr[idx].extra, active: !nr[idx].extra?.active } };
            return nr;
        });
    };
    const duplicateRow = (idx: number) => {
        saveHistory();
        setRows(prev => {
            const nr = [...prev];
            nr.splice(idx + 1, 0, { ...nr[idx], id: genId(), station: nr[idx].station + ' (Copia)', slots: JSON.parse(JSON.stringify(nr[idx].slots)) });
            return nr;
        });
    };

    // DND
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            saveHistory();
            setRows((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContext, setModalContext] = useState<any>(null);
    const openAssignModal = (date: string, postazione: string, shift: 'lunch' | 'dinner', orari: any) => {
        setModalContext({ date, postazione, shift, orari });
        setModalOpen(true);
    };
    const handleStaffSelect = async (staffId: number) => {
        try {
            await api.createAssignment({
                staffId, date: modalContext.date, startTime: modalContext.orari.start, endTime: modalContext.orari.end, postazione: modalContext.postazione
            });
            setModalOpen(false); loadData();
        } catch (e) { console.error(e); }
    };

    // [INNOVATION] Internal Clipboard for Shifts
    const [clipboard, setClipboard] = useState<any[] | null>(null);
    const [selection, setSelection] = useState<Set<string>>(new Set());
    const lastFocusedRef = useRef<string | null>(null);
    const anchorRef = useRef<string | null>(null);

    const moveFocus = (direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight', modifiers: { shift?: boolean, ctrl?: boolean } = {}) => {
        if (selection.size === 0) return;

        // Use ref for reliable focus tracking, fallback to selection
        const currentFocus = lastFocusedRef.current || Array.from(selection).pop();
        if (!currentFocus) return;

        const [rId, date, type] = currentFocus.split('|');
        const rIdx = rows.findIndex(r => r.id === rId);
        const dIdx = days.indexOf(date);

        if (rIdx === -1 || dIdx === -1) return;

        let nextRIdx = rIdx;
        let nextDIdx = dIdx;
        let nextType = type;

        if (direction === 'ArrowRight') {
            if (type === 'lunch') { nextType = 'dinner'; } else { nextType = 'lunch'; nextDIdx++; }
        } else if (direction === 'ArrowLeft') {
            if (type === 'dinner') { nextType = 'lunch'; } else { nextType = 'dinner'; nextDIdx--; }
        } else if (direction === 'ArrowDown') { nextRIdx++; }
        else if (direction === 'ArrowUp') { nextRIdx--; }

        // Bounds check
        if (nextRIdx >= 0 && nextRIdx < rows.length && nextDIdx >= 0 && nextDIdx < days.length) {
            const nextRow = rows[nextRIdx];
            const nextDate = days[nextDIdx];
            const nextId = `${nextRow.id}|${nextDate}|${nextType}`;

            lastFocusedRef.current = nextId;

            if (modifiers.shift) {
                // Range selection
                const anchor = anchorRef.current || currentFocus;
                const [aId, aDate, aType] = anchor.split('|');
                const aRIdx = rows.findIndex(r => r.id === aId);
                const aDIdx = days.indexOf(aDate);

                const minR = Math.min(aRIdx, nextRIdx);
                const maxR = Math.max(aRIdx, nextRIdx);

                const getX = (dI: number, t: string) => dI * 2 + (t === 'dinner' ? 1 : 0);
                const startX = getX(aDIdx, aType);
                const endX = getX(nextDIdx, nextType);
                const minX = Math.min(startX, endX);
                const maxX = Math.max(startX, endX);

                const finalSel = new Set<string>();
                for (let r = minR; r <= maxR; r++) {
                    const rowId = rows[r].id;
                    for (let x = minX; x <= maxX; x++) {
                        const dayI = Math.floor(x / 2);
                        const isD = x % 2 === 1;
                        if (dayI < days.length) {
                            finalSel.add(`${rowId}|${days[dayI]}|${isD ? 'dinner' : 'lunch'}`);
                        }
                    }
                }
                setSelection(finalSel);

            } else if (modifiers.ctrl) {
                // Add to selection (Multi-cursor style)
                setSelection(prev => {
                    const next = new Set(prev);
                    next.add(nextId);
                    return next;
                });
                anchorRef.current = nextId;
            } else {
                // Simple move
                setSelection(new Set([nextId]));
                anchorRef.current = nextId;
            }
        }
    };

    const handleSelect = (id: string, multi: boolean) => {
        // Update anchor and focus on click
        lastFocusedRef.current = id;
        if (!multi) anchorRef.current = id;

        setSelection(prev => {
            const next = new Set(multi ? prev : []);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // [INNOVATION] Undo/Redo History
    const [history, setHistory] = useState<CoverageRow[][]>([]);
    const [future, setFuture] = useState<CoverageRow[][]>([]);

    const saveHistory = () => {
        setHistory(prev => {
            const newHist = [...prev, JSON.parse(JSON.stringify(rows))];
            if (newHist.length > 50) newHist.shift(); // Limit history depth
            return newHist;
        });
        setFuture([]); // Clear redo stack on new action
    };

    const undo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setFuture(prev => [rows, ...prev]);
        setRows(previous);
        setHistory(prev => prev.slice(0, -1));
    };

    const redo = () => {
        if (future.length === 0) return;
        const next = future[0];
        setHistory(prev => [...prev, rows]);
        setRows(next);
        setFuture(prev => prev.slice(1));
    };

    // Global Keyboard Handler for Copy/Paste/Undo/Redo/Navigation
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Only trigger if we have a selection and not editing an input
            if ((e.target as HTMLElement).tagName === 'INPUT') return;

            // Navigation (Arrow Keys)
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                moveFocus(
                    e.key as 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
                    { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }
                );
                return;
            }

            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                redo();
                return;
            }

            if (selection.size === 0) return;

            // Copy
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                const selectedData: any[] = [];
                selection.forEach(id => {
                    const [rId, date, type] = id.split('|');
                    const row = rows.find(r => r.id === rId);
                    let start = '', end = '';

                    if (row) {
                        if (row.slots && row.slots[date]) {
                            const s = row.slots[date];
                            start = type === 'lunch' ? s.lIn || '' : s.dIn || '';
                            end = type === 'lunch' ? s.lOut || '' : s.dOut || '';
                        }

                        selectedData.push({
                            strId: id,
                            rIdx: rows.indexOf(row),
                            dateIdx: days.indexOf(date),
                            type,
                            val: { start, end }
                        });
                    }
                });
                if (selectedData.length > 0) {
                    selectedData.sort((a, b) => (a.rIdx - b.rIdx) || (a.dateIdx - b.dateIdx));
                    setClipboard(selectedData);
                }
            }

            // Paste
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                if (!clipboard || clipboard.length === 0) return;

                saveHistory();

                const targets = Array.from(selection);
                const targetObjs = targets.map(id => {
                    const [rId, date, type] = id.split('|');
                    const row = rows.find(r => r.id === rId);
                    return { id, rIdx: rows.indexOf(row!), dateIdx: days.indexOf(date), type };
                }).sort((a, b) => (a.rIdx - b.rIdx) || (a.dateIdx - b.dateIdx));

                if (targetObjs.length === 0) return;
                const anchor = targetObjs[0];

                setRows(prev => {
                    const nr = prev.map(r => ({ ...r, slots: { ...r.slots } }));

                    if (clipboard.length === 1) {
                        const { val } = clipboard[0];
                        targetObjs.forEach(t => {
                            const r = nr[t.rIdx];
                            if (r) {
                                if (!r.slots[days[t.dateIdx]]) r.slots[days[t.dateIdx]] = { lIn: '', lOut: '', dIn: '', dOut: '' };
                                const s = r.slots[days[t.dateIdx]];
                                if (t.type === 'lunch') { s.lIn = val.start; s.lOut = val.end; }
                                else { s.dIn = val.start; s.dOut = val.end; }
                            }
                        });
                    } else {
                        const clipAnchor = clipboard[0];
                        clipboard.forEach(item => {
                            const rDiff = item.rIdx - clipAnchor.rIdx;
                            const dDiff = item.dateIdx - clipAnchor.dateIdx;

                            const targetR = anchor.rIdx + rDiff;
                            const targetD = anchor.dateIdx + dDiff;

                            if (targetR >= 0 && targetR < nr.length && targetD >= 0 && targetD < days.length) {
                                const r = nr[targetR];
                                const d = days[targetD];
                                if (!r.slots[d]) r.slots[d] = { lIn: '', lOut: '', dIn: '', dOut: '' };
                                const s = r.slots[d];
                                if (item.type === 'lunch') { s.lIn = item.val.start; s.lOut = item.val.end; }
                                else { s.dIn = item.val.start; s.dOut = item.val.end; }
                            }
                        });
                    }
                    return nr;
                });
            }

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                saveHistory();
                setRows(prev => {
                    const nr = prev.map(r => ({ ...r, slots: { ...r.slots } }));
                    selection.forEach(id => {
                        const [rId, date, type] = id.split('|');
                        const row = nr.find(r => r.id === rId);
                        if (row && row.slots[date]) {
                            row.slots[date] = { ...row.slots[date] };
                            if (type === 'lunch') { row.slots[date].lIn = ''; row.slots[date].lOut = ''; }
                            else { row.slots[date].dIn = ''; row.slots[date].dOut = ''; }
                        }
                    });
                    return nr;
                });
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [selection, rows, clipboard, days, history, future]);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between z-30">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <BarChart className="text-indigo-600" /> Fabbisogno Orario
                    </h1>
                    <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-100">
                            <Calendar size={16} className="text-indigo-600" />
                            <div className="flex flex-col">
                                <span className="text-[9px] uppercase font-bold text-indigo-400 leading-none">ANNO</span>
                                <select
                                    value={currentYear}
                                    onChange={e => setCurrentYear(Number(e.target.value))}
                                    className="bg-transparent font-bold text-gray-700 text-xs outline-none cursor-pointer p-0 border-none focus:ring-0"
                                >
                                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-gray-200"></div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setWeek(week > 1 ? week - 1 : 52)} // Wrap or stop? usually stop at 1 but wrapping is nice if explicit
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 transition"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            <div className="flex flex-col items-center min-w-[140px] px-2 cursor-pointer hover:bg-gray-50 rounded" title="Clicca per cambiare settimana">
                                <span className="text-sm font-bold text-gray-800 flex items-center gap-1">
                                    Settimana
                                    <input
                                        type="number"
                                        min={1} max={53}
                                        value={weekInput}
                                        onChange={e => setWeekInput(e.target.value)}
                                        onBlur={e => {
                                            let val = parseInt(e.target.value);
                                            if (val < 1) val = 1; if (val > 53) val = 53;
                                            setWeek(val);
                                            setWeekInput(val.toString());
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                                        className="w-8 text-center bg-transparent focus:bg-white focus:ring-1 ring-indigo-500 rounded text-indigo-700"
                                    />
                                </span>
                                <span className="text-[10px] font-medium text-gray-500">
                                    {(() => {
                                        const { start, end } = getWeekRange(week, currentYear);
                                        const fmt = (d: string) => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
                                        return `${fmt(start)} - ${fmt(end)}`;
                                    })()}
                                </span>
                            </div>

                            <button
                                onClick={() => setWeek(week < 53 ? week + 1 : 1)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 transition"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                    {/* [INNOVATION] Cost Preview */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-xs font-bold shadow-sm">
                        <Zap size={14} className="fill-emerald-500" />
                        <span>Costo Stimato ({effectiveRate.toFixed(2)}€/h):</span>
                        <input
                            type="number"
                            className="w-12 bg-white border border-emerald-200 rounded px-1 text-center"
                            value={effectiveRate}
                            onChange={(e) => setCostOverride(parseFloat(e.target.value) || 0)}
                            title="Modifica costo orario medio"
                        />
                        <span>= ~{(estimatedTotalCost).toLocaleString('it-IT')}€</span>
                    </div>
                    {/* Clipboard Status */}
                    {clipboard && clipboard.length > 0 && (
                        <div className="hidden md:flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-[10px] font-bold animate-pulse">
                            <span>📋 Copiati {clipboard.length} elementi</span>
                            <button onClick={() => { setClipboard(null); setSelection(new Set()); }} className="hover:text-red-600"><X size={10} /></button>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <label className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs font-bold shadow-sm hover:bg-green-700 cursor-pointer">
                        <Upload size={14} /> Importa CSV
                        <input type="file" hidden accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
                    </label>
                    <button onClick={handleSmartDistribute} className="group relative hidden md:flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded text-xs font-bold shadow hover:shadow-lg transition">
                        <Sparkles size={14} className="animate-pulse" /> Auto-Distribute
                        <span className="absolute -bottom-8 right-0 w-48 bg-gray-800 text-white text-[10px] p-2 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none z-50">
                            Genera orari automaticamente basandosi sul Budget Ore
                        </span>
                    </button>
                    <Link
                        href={`/requirements/details?year=${currentYear}&week=${week}`}
                        className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-xs font-bold shadow-sm hover:bg-gray-50 transition"
                        title="Vedi dettaglio copertura 15 min"
                    >
                        <LayoutGrid size={14} /> Dettaglio
                    </Link>
                    <button onClick={handleDuplicatePreviousWeek} title="Copia assegnazioni settimana scorsa" className="hidden md:flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-xs font-bold shadow-sm hover:bg-gray-50 transition">
                        <Upload size={14} className="rotate-180" /> Copia Scorsa
                    </button>

                    <div className="h-6 w-px bg-gray-300 mx-2"></div>

                    <button onClick={() => setShowHidden(!showHidden)} className="px-3 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">
                        {showHidden ? 'Nascondi Inattivi' : 'Mostra Inattivi'}
                    </button>
                    <button
                        onClick={() => handleSave(false)}
                        className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold shadow-sm transition-all ${saveStatus === 'saved' ? 'bg-green-600 text-white' :
                            saveStatus === 'saving' ? 'bg-indigo-400 text-white animate-pulse' :
                                saveStatus === 'error' ? 'bg-red-600 text-white' :
                                    'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {saveStatus === 'saving' ? <Zap size={14} className="animate-spin" /> :
                            saveStatus === 'saved' ? <Sparkles size={14} /> :
                                saveStatus === 'error' ? 'Errore!' : 'Salva'}
                    </button>
                    <button onClick={addRow} className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-bold hover:bg-gray-300"><Plus size={14} /></button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto relative">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <table className="w-full border-collapse text-xs min-w-[1500px]">
                        <thead className="bg-white sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="sticky left-0 bg-white border p-2 min-w-[50px] z-30">#</th>
                                <th className="sticky left-[50px] bg-white border p-2 min-w-[150px] z-30 text-left">Postazione</th>
                                {days.map((d, i) => (
                                    <th key={d} colSpan={2} className="border p-1 text-center bg-gray-50">
                                        <div className="font-bold text-gray-700">{dayNames[i]}</div>
                                        <div className="text-[9px] text-gray-400">{d}</div>
                                    </th>
                                ))}
                                <th className="bg-white border"></th>
                            </tr>
                            <tr>
                                <th className="sticky left-0 bg-white border z-30"></th>
                                <th className="sticky left-[50px] bg-white border z-30"></th>
                                {days.map(d => (
                                    <React.Fragment key={d + 'sub'}>
                                        <th className="bg-blue-50 border text-[9px] min-w-[100px] text-blue-800 font-semibold">PRANZO</th>
                                        <th className="bg-indigo-50 border text-[9px] min-w-[100px] text-indigo-800 font-semibold">CENA</th>
                                    </React.Fragment>
                                ))}
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                                {rows.map((row, rIdx) => {
                                    if (!showHidden && row.extra?.active === false) return null;

                                    // Visual Headers
                                    const isCucinaCurrent = isCucina(row.station);
                                    let prevRow = null;
                                    // Find previous visible row to compare category
                                    for (let i = rIdx - 1; i >= 0; i--) {
                                        if (showHidden || rows[i].extra?.active !== false) {
                                            prevRow = rows[i];
                                            break;
                                        }
                                    }
                                    const isCucinaPrev = prevRow ? isCucina(prevRow.station) : null;

                                    let header = null;
                                    // If this is the very first visible row OR category changed
                                    if (prevRow === null || (isCucinaPrev !== isCucinaCurrent)) {
                                        header = (
                                            <tr key={`header-${isCucinaCurrent ? 'cucina' : 'sala'}`} className="bg-gray-100 border-y-2 border-gray-300">
                                                <td colSpan={2 + days.length * 2 + 1} className="p-1 px-3 font-bold text-gray-600 uppercase tracking-wider text-left bg-gradient-to-r from-gray-100 to-white">
                                                    {isCucinaCurrent ? '🔪 Cucina' : '🍽️ Sala'}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <React.Fragment key={row.id}>
                                            {header}
                                            <SortableRow
                                                row={row}
                                                rIdx={rIdx}
                                                days={days}
                                                assignments={assignments}
                                                isActive={row.extra?.active !== false}
                                                toggleActive={toggleActive}
                                                duplicateRow={duplicateRow}
                                                removeRow={removeRow}
                                                updateCell={updateCell}
                                                updateSlot={updateSlot}
                                                openAssignModal={openAssignModal}
                                                clipboard={clipboard}
                                                setClipboard={setClipboard}
                                                selection={selection}
                                                handleSelect={handleSelect}
                                                moveFocus={moveFocus}
                                            />
                                        </React.Fragment>
                                    );
                                })}
                            </SortableContext>
                        </tbody>
                        <tfoot className="bg-white sticky bottom-0 z-40 font-sans shadow-lg border-t-2 border-indigo-100 text-xs">
                            <tr className="bg-gray-50">
                                <td colSpan={2} className="p-2 text-right font-bold text-indigo-900 border-r">FABBISOGNO</td>
                                {days.map((d, i) => (
                                    <React.Fragment key={i}>
                                        <td className="p-2 text-center border font-bold text-blue-700">{dailyLunchTotals[i].toFixed(1)} h</td>
                                        <td className="p-2 text-center border font-bold text-indigo-700">{dailyDinnerTotals[i].toFixed(1)} h</td>
                                    </React.Fragment>
                                ))}
                                <td></td>
                            </tr>
                            <tr className="bg-emerald-50">
                                <td colSpan={2} className="p-2 text-right font-bold text-emerald-900 border-r">BUDGET TOTALE</td>
                                {days.map((d, i) => (
                                    <React.Fragment key={i}>
                                        <td className="p-2 text-center border text-emerald-800 font-medium">{(budgetLunchHours[d] || 0) > 0 ? (budgetLunchHours[d] || 0).toFixed(1) : '-'}</td>
                                        <td className="p-2 text-center border text-emerald-800 font-medium">{(budgetDinnerHours[d] || 0) > 0 ? (budgetDinnerHours[d] || 0).toFixed(1) : '-'}</td>
                                    </React.Fragment>
                                ))}
                                <td></td>
                            </tr>
                            {/* Budget Kitchen */}
                            <tr className="bg-orange-50/50">
                                <td colSpan={2} className="p-2 text-right font-bold text-orange-900 border-r text-[10px]">BUDGET CUCINA</td>
                                {days.map((d, i) => (
                                    <React.Fragment key={i}>
                                        <td className="p-2 text-center border text-orange-800 font-medium text-[10px]">{(budgetLunchKitchen[d] || 0) > 0 ? (budgetLunchKitchen[d] || 0).toFixed(1) : '-'}</td>
                                        <td className="p-2 text-center border text-orange-800 font-medium text-[10px]">{(budgetDinnerKitchen[d] || 0) > 0 ? (budgetDinnerKitchen[d] || 0).toFixed(1) : '-'}</td>
                                    </React.Fragment>
                                ))}
                                <td></td>
                            </tr>
                            {/* Budget Hall */}
                            <tr className="bg-indigo-50/50">
                                <td colSpan={2} className="p-2 text-right font-bold text-indigo-900 border-r text-[10px]">BUDGET SALA</td>
                                {days.map((d, i) => (
                                    <React.Fragment key={i}>
                                        <td className="p-2 text-center border text-indigo-800 font-medium text-[10px]">{(budgetLunchHall[d] || 0) > 0 ? (budgetLunchHall[d] || 0).toFixed(1) : '-'}</td>
                                        <td className="p-2 text-center border text-indigo-800 font-medium text-[10px]">{(budgetDinnerHall[d] || 0) > 0 ? (budgetDinnerHall[d] || 0).toFixed(1) : '-'}</td>
                                    </React.Fragment>
                                ))}
                                <td></td>
                            </tr>
                            {/* Productivity Calculation */}
                            <tr className="bg-purple-50/50 border-t border-purple-200">
                                <td colSpan={2} className="p-2 text-right font-bold text-purple-900 border-r text-[10px]">PRODUTTIVITÀ STIMATA (€/h)</td>
                                {days.map((d, i) => {
                                    // Total Revenue Budget
                                    const rev = budgetRevenue[d] || 0;

                                    // Let's grab daily assigned hours from a helper function we can call safely
                                    const getDailyHours = () => {
                                        let l = 0, di = 0;
                                        // Filter assignments for this day
                                        // This is heavy O(N*M). Optimization: Pre-calc in a Memo.
                                        // Ensure we have access to `assignments` (scheduleData in state?) -> `assignments` state.
                                        // Actually `assignments` is a list of all shifts.
                                        const daily = assignments.filter((a: any) => a.data === d);
                                        daily.forEach((a: any) => {
                                            const s = a.start_time || a.shiftTemplate?.oraInizio;
                                            const e = a.end_time || a.shiftTemplate?.oraFine;
                                            if (s && e) {
                                                const h = calcHours(s, e);
                                                // Split logic (rough)
                                                const [hh] = s.split(':');
                                                if (parseInt(hh) < 16) l += h; else di += h;
                                            }
                                        });
                                        return l + di;
                                    };

                                    const totAssigned = getDailyHours();
                                    const prod = totAssigned > 0 ? (rev / totAssigned).toFixed(1) : '-';

                                    return (
                                        <React.Fragment key={i}>
                                            <td colSpan={2} className="p-2 text-center border text-purple-800 font-bold text-[10px]">
                                                {prod !== '-' ? `${prod}€` : '-'}
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </DndContext>
            </div>
            {/* Modals */}
            {modalContext && (
                <StaffSelectionModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSelect={handleStaffSelect}
                    date={modalContext.date}
                    postazione={modalContext.postazione}
                    shift={modalContext.shift}
                    orari={modalContext.orari}
                    staff={staff}
                    existingAssignments={assignments}
                    weeklyHours={assignments.reduce((acc: any, a: any) => {
                        if (a.staffId && a.start_time && a.end_time) {
                            const [h1, m1] = a.start_time.split(':').map(Number);
                            const [h2, m2] = a.end_time.split(':').map(Number);
                            let dur = (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60);
                            if (dur < 0) dur += 24;
                            acc[a.staffId] = (acc[a.staffId] || 0) + dur;
                        }
                        return acc;
                    }, {})}
                />
            )}
        </div>
    );
};

const SortableRow = ({ row, rIdx, days, assignments, isActive, toggleActive, duplicateRow, removeRow, updateCell, updateSlot, openAssignModal, clipboard, setClipboard, selection, handleSelect, moveFocus }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
        <tr ref={setNodeRef} style={style} className={`border-b group hover:bg-gray-50 ${!isActive ? 'bg-red-50/30 opacity-70' : ''}`}>
            <td className={`sticky left-0 border-r p-1 text-center z-10 ${!isActive ? 'bg-red-50' : 'bg-white'}`}>
                <div {...attributes} {...listeners} className="cursor-grab p-1"><GripVertical size={14} className="text-gray-400" /></div>
            </td>
            <td className={`sticky left-[50px] border-r p-1 z-10 ${!isActive ? 'bg-red-50' : 'bg-white'}`}>
                <div className="flex items-center gap-1">
                    {!isActive && <EyeOff size={10} className="text-red-400" />}
                    <input
                        value={row.station}
                        onChange={e => updateCell(rIdx, 'station', '', e.target.value)}
                        className={`w-full text-xs font-bold outline-none bg-transparent ${!isActive ? 'text-gray-400 line-through italic' : ''}`}
                        placeholder="Nome postazione"
                    />
                </div>
                <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition scale-90 origin-left">
                    <button onClick={() => toggleActive(rIdx)} title="Attiva/Disattiva" className="text-gray-500 hover:text-gray-700">{isActive ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                    <button onClick={() => duplicateRow(rIdx)} title="Duplica" className="text-blue-500 hover:text-blue-700"><span className="text-[10px] font-bold">D</span></button>
                    <button onClick={() => removeRow(rIdx)} title="Elimina" className="text-red-500 hover:text-red-700"><Trash2 size={12} /></button>
                </div>
            </td>
            {days.map((d: string) => (
                <DayCells key={d} date={d} row={row} rIdx={rIdx} assignments={assignments} updateSlot={updateSlot} openAssignModal={openAssignModal} clipboard={clipboard} setClipboard={setClipboard} selection={selection} handleSelect={handleSelect} moveFocus={moveFocus} />
            ))}
            <td className="border bg-white"></td>
        </tr>
    );
};

// [INNOVATION] Heatmap Visuals in Cells
const DayCells = React.memo(({ date, row, rIdx, assignments, updateSlot, openAssignModal, clipboard, setClipboard, selection, handleSelect, moveFocus }: any) => {
    const s = row.slots[date] || { lIn: '', lOut: '', dIn: '', dOut: '' };

    // Normalize helper
    const matchesStation = (aStation: string, rStation: string) => {
        if (!aStation || !rStation) return false;
        return aStation.trim().toLowerCase() === rStation.trim().toLowerCase();
    };

    const dayAssigns = assignments.filter((a: any) => a.data === date && matchesStation(a.postazione, row.station));

    // Calculate heat colors
    const hL = calcHours(s.lIn, s.lOut);
    const hD = calcHours(s.dIn, s.dOut);

    const getHeatClass = (h: number, base: string) => {
        if (h === 0) return 'bg-white';
        if (h > 6) return `bg-${base}-200/50`; // Heavy shift
        if (h > 4) return `bg-${base}-100/50`; // Medium
        return `bg-${base}-50/30`; // Light
    };

    return (
        <React.Fragment>
            <td className={`border-r p-0.5 min-w-[100px] transition-colors ${getHeatClass(hL, 'blue')}`}>
                <ShiftEntry
                    start={s.lIn} end={s.lOut}
                    assignments={dayAssigns.filter((a: any) => (a.start_time || '') < '16:00')}
                    onChange={(f: string, v: string) => updateSlot(rIdx, date, f, v)}
                    onAssign={() => openAssignModal(date, row.station, 'lunch', { start: s.lIn, end: s.lOut })}
                    type="lunch"
                    id={`${row.id}|${date}|lunch`}
                    selection={selection}
                    handleSelect={handleSelect}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    moveFocus={moveFocus}
                />
            </td>
            <td className={`border-r p-0.5 min-w-[100px] transition-colors ${getHeatClass(hD, 'indigo')}`}>
                <ShiftEntry
                    start={s.dIn} end={s.dOut}
                    assignments={dayAssigns.filter((a: any) => (a.start_time || '') >= '16:00')}
                    onChange={(f: string, v: string) => updateSlot(rIdx, date, f, v)}
                    onAssign={() => openAssignModal(date, row.station, 'dinner', { start: s.dIn, end: s.dOut })}
                    type="dinner"
                    id={`${row.id}|${date}|dinner`}
                    selection={selection}
                    handleSelect={handleSelect}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    moveFocus={moveFocus}
                />
            </td>
        </React.Fragment>
    );
});
DayCells.displayName = 'DayCells';

const ShiftEntry = ({ start, end, assignments, onChange, onAssign, type, clipboard, setClipboard, id, selection, handleSelect, moveFocus }: any) => {
    const [edit, setEdit] = useState(false);
    const isSelected = selection?.has(id);
    const popupRef = React.useRef<HTMLDivElement>(null);
    const startRef = React.useRef<HTMLInputElement>(null);
    const endRef = React.useRef<HTMLInputElement>(null);

    // Close on Click Outside
    useEffect(() => {
        if (!edit) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setEdit(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [edit]);

    const handleClick = (e: React.MouseEvent) => {
        if (e.detail === 1) {
            if (handleSelect) {
                if (e.ctrlKey || e.metaKey) {
                    handleSelect(id, true);
                } else {
                    handleSelect(id, false);
                }
            }
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        setEdit(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // [INNOVATION] Navigation (Arrow Keys) while focused on cell container
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            if (moveFocus) moveFocus(e.key, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            if (selection && selection.size > 0 && !isSelected) return;
            e.preventDefault();
            if (start || end) {
                setClipboard([{
                    strId: 'local',
                    val: { start, end },
                    type
                }]);
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (selection && selection.size > 0) return;
            e.preventDefault();
            if (clipboard && clipboard.length > 0) {
                const item = clipboard[0];
                const val = item.val;
                onChange(type === 'lunch' ? 'lIn' : 'dIn', val.start);
                setTimeout(() => onChange(type === 'lunch' ? 'lOut' : 'dOut', val.end), 0);
            }
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (!edit) {
                onChange(type === 'lunch' ? 'lIn' : 'dIn', '');
                setTimeout(() => onChange(type === 'lunch' ? 'lOut' : 'dOut', ''), 0);
            }
        }
        // Enter to edit
        if (e.key === 'Enter') {
            e.preventDefault();
            setEdit(true);
        }
    };

    // [INNOVATION] Navigation from Inputs
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, inputType?: 'start' | 'end') => {
        if (e.key === 'Enter') {
            setEdit(false);
            return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            // [INNOVATION] Internal Navigation between Start/End inputs
            if (!e.shiftKey) {
                const target = e.currentTarget;
                const value = target.value;
                const selectionStart = target.selectionStart;

                // Right Arrow: From Start -> End (only if at end of text)
                if (e.key === 'ArrowRight' && inputType === 'start') {
                    if (selectionStart === value.length) {
                        e.preventDefault();
                        endRef.current?.focus();
                        // Optional: Select all text in next input? Or create seamless typing?
                        // Let's just focus.
                        return;
                    }
                }

                // Left Arrow: From End -> Start (only if at start of text)
                if (e.key === 'ArrowLeft' && inputType === 'end') {
                    if (selectionStart === 0) {
                        e.preventDefault();
                        startRef.current?.focus();
                        return;
                    }
                }
            }

            // Standard Grid Navigation (Close Edit & Move)
            // Only trigger if we are at the boundaries of the inputs themselves?
            // User probably wants to move to next CELL if at the very end.

            // Let's refine:
            // If ArrowRight on End Input (at end) -> Move to Next Cell
            // If ArrowLeft on Start Input (at start) -> Move to Prev Cell
            // Up/Down -> Always move cell (close edit)

            if (!e.shiftKey) {
                let shouldMoveCell = false;

                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') shouldMoveCell = true;

                if (e.key === 'ArrowRight' && inputType === 'end') {
                    if (e.currentTarget.selectionStart === e.currentTarget.value.length) shouldMoveCell = true;
                }

                if (e.key === 'ArrowLeft' && inputType === 'start') {
                    if (e.currentTarget.selectionStart === 0) shouldMoveCell = true;
                }

                if (shouldMoveCell) {
                    e.preventDefault();
                    setEdit(false);
                    if (moveFocus) {
                        moveFocus(e.key, { shift: false, ctrl: false });
                    }
                }
            }
        }
    };

    if (edit) {
        return (
            <div
                ref={popupRef}
                className="flex flex-col gap-1 z-50 absolute bg-white p-2 shadow-xl border rounded transform scale-105"
                onKeyDown={(e) => e.stopPropagation()} // Stop propagation to avoid global listener
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex gap-1 items-center">
                    <input
                        ref={startRef}
                        autoFocus
                        className="w-12 border rounded text-center text-sm p-1"
                        value={start}
                        placeholder="00:00"
                        onChange={e => onChange(type === 'lunch' ? 'lIn' : 'dIn', e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, 'start')}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        ref={endRef}
                        className="w-12 border rounded text-center text-sm p-1"
                        value={end}
                        placeholder="00:00"
                        onChange={e => onChange(type === 'lunch' ? 'lOut' : 'dOut', e.target.value)}
                        onKeyDown={(e) => handleInputKeyDown(e, 'end')}
                    />
                </div>
                <div className="flex justify-end">
                    <button onClick={() => setEdit(false)} className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-1 rounded font-bold">OK</button>
                </div>
            </div>
        );
    }

    const hasTime = start && end;
    const hours = calcHours(start, end);

    return (
        <div
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            className={`h-full min-h-[44px] rounded border border-dashed flex flex-col justify-between p-1.5 hover:bg-white/80 transition group relative outline-none ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 z-10' : 'focus:ring-2 focus:ring-blue-400'
                } ${hasTime ? 'border-transparent shadow-sm bg-white/60' : 'border-gray-200 hover:border-blue-300'}`}
        >
            {hasTime ? (
                <>
                    <div className="flex justify-between items-center cursor-pointer">
                        <span className={`font-bold text-[11px] ${hours > 6 ? 'text-blue-800' : 'text-gray-700'}`}>{start}-{end}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] text-gray-400 font-medium">{hours.toFixed(1)}h</span>
                        <div className="flex -space-x-1 cursor-pointer hover:scale-110 transition" onClick={(e) => { e.stopPropagation(); onAssign(); }}>
                            {assignments.length > 0 ? (
                                assignments.map((a: any, i: number) => (
                                    <div key={i} className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center border-2 border-white shadow-sm" title={a.employee_name}>
                                        {a.employee_name?.substring(0, 1) || 'S'}
                                    </div>
                                ))
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 group-hover:bg-blue-100 group-hover:text-blue-500 transition">
                                    <Plus size={10} />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div
                    className="w-full h-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition"
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent selection toggle
                        setEdit(true);
                    }}
                >
                    <div className="text-gray-300 text-[9px] font-bold group-hover:hidden">{type === 'lunch' ? 'PRANZO' : 'CENA'}</div>
                    <Plus size={14} className="text-blue-400 hidden group-hover:block" />
                </div>
            )}
        </div>
    );
};

export default function RequirementsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
            <RequirementsContent />
        </Suspense>
    );
}
