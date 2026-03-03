
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import QuarterTimeInput from '@/components/QuarterTimeInput';
import { Calendar, Save, Trash2, Download, Upload, AlertTriangle, CheckCircle, Wand2, Paintbrush, Clock, DollarSign, TrendingUp, Target, UserPlus, Mail, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid, Brain, BarChart3, Zap } from 'lucide-react';
import { ShiftEditorModal } from '@/components/shift-editor-modal';
import { getWeekNumber, getWeekRange, getDatesInRange, getWeeksList } from '@/lib/date-utils';
import StaffSelectionModal from '@/components/StaffSelectionModal';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { DraggableShiftItem } from '@/components/DraggableShiftItem';
import { DroppableCell } from '@/components/DroppableCell';
import { ContextMenu } from '@/components/ShiftContextMenu';
import StaffReorderModal from '@/components/StaffReorderModal';
import Toast from '@/components/Toast';
import PITAnalysisPanel from '@/components/PITAnalysisPanel';
import type { WeekAnalysis } from '@/lib/pitEngine';

// --- Helpers ---
interface Assignment {
    id: number;
    staffId: number;
    data: string;
    start_time: string | null;
    end_time: string | null;
    postazione: string;
    note?: string;
    status: boolean;
    shiftTemplate?: any;
    shiftTemplateId?: number;
}

interface Staff {
    id: number;
    nome: string;
    cognome: string;
    ruolo: string;
    oreMassime?: number;
    costoOra?: number;
    listIndex?: number;
    unavailabilities?: any[];
}

interface ShiftTemplate {
    id: number;
    nome: string;
    oraInizio: string;
    oraFine: string;
    ruoloRichiesto: string;
    giorniValidi: string;
}

export default function CalendarPage() {
    // ... state ...
    const [schedule, setSchedule] = useState<Assignment[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [matrix, setMatrix] = useState<Record<number, Record<string, Assignment[]>>>({});
    const [unavailabilities, setUnavailabilities] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]); // New state for requests
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        api.getProfile().then(setCurrentUser).catch(console.error);
    }, []);

    const isReadOnly = currentUser?.role !== 'ADMIN' && currentUser?.role !== 'MANAGER' && currentUser?.role !== 'OWNER';

    const [budgets, setBudgets] = useState<any[]>([]);
    const [forecastData, setForecastData] = useState<string[][]>([]);

    // --- Persistent week/year (remembers last opened week) ---
    const getInitialWeekYear = () => {
        try {
            const saved = localStorage.getItem('calendar_last_week');
            if (saved) {
                const { week, year } = JSON.parse(saved);
                if (week >= 1 && week <= 53 && year >= 2020) return { week, year };
            }
        } catch { }
        // Fallback: current ISO week
        const now = new Date();
        const jan4 = new Date(now.getFullYear(), 0, 4);
        const week = Math.ceil(((now.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
        return { week: Math.max(1, Math.min(53, week)), year: now.getFullYear() };
    };
    const _init = getInitialWeekYear();

    const [currentYear, setCurrentYear] = useState(_init.year);
    const [selectedWeek, setSelectedWeek] = useState(_init.week);
    const [weekInput, setWeekInput] = useState<string>(String(_init.week));
    const [range, setRange] = useState(getWeekRange(_init.week, _init.year));
    const [missingShifts, setMissingShifts] = useState<any[]>([]);
    const [showMissingModal, setShowMissingModal] = useState(false);
    const [manualAssignOpen, setManualAssignOpen] = useState(false);
    const [manualAssignContext, setManualAssignContext] = useState<any>(null);

    const [panarelloActive, setPanarelloActive] = useState(false);
    const [editingCell, setEditingCell] = useState<any>(null);
    const [customTimes, setCustomTimes] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(false);
    const [zoom, setZoom] = useState(1);

    // Toast notifications
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string } | null>(null);

    // Staff Reordering
    const [showReorderModal, setShowReorderModal] = useState(false);

    // Collapsed groups state
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const toggleGroup = (title: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    // Quick area filter
    const [filterArea, setFilterArea] = useState<string | null>(null);

    // PIT Analysis State
    const [pitData, setPitData] = useState<WeekAnalysis | null>(null);
    const [pitLoading, setPitLoading] = useState(false);
    const [showPITPanel, setShowPITPanel] = useState(false);

    // Column width (resizable)
    const [colWidth, setColWidth] = useState<number>(() => {
        try { const w = localStorage.getItem('calendar_col_width'); return w ? Math.max(110, Math.min(280, Number(w))) : 170; } catch { return 170; }
    });
    const resizeDragRef = useRef<{ startX: number; startW: number } | null>(null);
    const startColResize = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        resizeDragRef.current = { startX: clientX, startW: colWidth };
        const onMove = (ev: MouseEvent | TouchEvent) => {
            const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
            const newW = Math.max(110, Math.min(280, resizeDragRef.current!.startW + (cx - resizeDragRef.current!.startX)));
            setColWidth(newW);
        };
        const onUp = () => {
            try { localStorage.setItem('calendar_col_width', String(colWidth)); } catch { }
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
            resizeDragRef.current = null;
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onUp);
    };

    // DnD & Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, assignment: Assignment } | null>(null);
    const [clipboard, setClipboard] = useState<Assignment | null>(null);
    const [dragActiveId, setDragActiveId] = useState<number | null>(null);
    const [sendingEmail, setSendingEmail] = useState(false);

    const handleBroadcast = async () => {
        if (!confirm(`Vuoi inviare i turni della settimana ${selectedWeek} a TUTTI i dipendenti via email?`)) return;

        setSendingEmail(true);
        try {
            const tableElement = document.querySelector('table');
            if (!tableElement) throw new Error("Tabella non trovata");

            const tableClone = tableElement.cloneNode(true) as HTMLElement;
            const inputs = tableClone.querySelectorAll('input');
            inputs.forEach((input: any) => {
                const span = document.createElement('span');
                span.textContent = input.value;
                input.parentNode?.replaceChild(span, input);
            });

            tableClone.setAttribute('style', 'width: 100%; border-collapse: collapse; font-family: Arial;');
            tableClone.querySelectorAll('th, td').forEach((cell: any) => {
                cell.style.border = '1px solid #ddd';
                cell.style.padding = '8px';
                cell.style.textAlign = 'center';
            });

            const htmlTable = tableClone.outerHTML;

            await api.notifyBroadcast(
                `${range.start} - ${range.end} (Week ${selectedWeek})`,
                htmlTable
            );

            alert("Email inviate con successo! 📧");
        } catch (e: any) {
            alert("Errore invio: " + e.message);
        } finally {
            setSendingEmail(false);
        }
    };

    const handleTrainAI = async () => {
        if (!confirm(`Vuoi salvare l'attuale disposizione dei turni come modello per l'AI?
(Settimana ${selectedWeek})`)) return;

        setLoading(true);
        try {
            await api.trainAI({
                weekStart: range.start,
                data: schedule,
                rating: 5
            });
            setToast({ type: 'success', title: 'AI Addestrata!', message: 'Modello salvato con successo.' });
        } catch (error: any) {
            console.error(error);
            setToast({ type: 'error', title: 'Errore Addestramento', message: error.message || 'Impossibile salvare il modello.' });
        } finally {
            setLoading(false);
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Prevent drag on click
            },
        })
    );

    // If Read Only, disable drag and drop effectively by not handling drag end or visual cues?
    // Better: Conditional wrapping or passing disabled prop to Draggables.
    // For now, we will block the handleDragEnd logic and hide overlays.

    const handleDragEnd = async (event: DragEndEvent) => {
        if (isReadOnly) return;
        const { active, over } = event;
        setDragActiveId(null);

        if (!over) return;

        const activeIdStr = active.id.toString();
        const assignmentId = Number(activeIdStr.replace('shift-', ''));

        const overIdStr = over.id.toString();
        const parts = overIdStr.split('|');
        if (parts.length < 3) return;

        const [staffIdRaw, dateStr, typeStr] = parts;
        const newStaffId = Number(staffIdRaw.replace('cell-', ''));
        const newDate = dateStr;
        const newType = typeStr as 'PRANZO' | 'SERA';

        const currentAsn = schedule.find(a => a.id === assignmentId);
        if (!currentAsn) return;

        // Skip if dropping on same cell
        if (currentAsn.staffId === newStaffId && currentAsn.data === newDate) {
            return;
        }

        // --- Double Shift Check ---
        // Check if the target staff already has a shift on the SAME day but DIFFERENT type
        const otherType = newType === 'PRANZO' ? 'SERA' : 'PRANZO';
        const existingShift = getShift(newStaffId, newDate, otherType);

        if (existingShift) {
            // Check if we are just swapping with our own shift (unlikely in this logic, but safe to check)
            if (existingShift.id !== currentAsn.id) {
                const targetStaffName = staff.find(s => s.id === newStaffId)?.nome || 'Dipendente';
                alert(`⛔ OPERAZIONE NEGATA

${targetStaffName} ha già un turno di ${otherType} in questa data.
Non è possibile assegnare Pranzo e Cena allo stesso dipendente.`);
                return;
            }
        }

        // Target Assignment (Occupied Cell)
        const targetAsn = getShift(newStaffId, newDate, newType);

        // --- Validation: Role Compatibility (Optional Warning) ---
        const targetStaff = staff.find(s => s.id === newStaffId);
        const sourceRole = staff.find(s => s.id === currentAsn.staffId)?.ruolo?.toLowerCase() || '';
        const targetRole = targetStaff?.ruolo?.toLowerCase() || '';

        // Simple check: Kitchen vs Hall
        const isSourceKitchen = sourceRole.includes('cucina') || sourceRole.includes('chef') || sourceRole.includes('cuoco');
        const isTargetKitchen = targetRole.includes('cucina') || targetRole.includes('chef') || targetRole.includes('cuoco');

        if (isSourceKitchen !== isTargetKitchen) {
            if (!confirm(`⚠️ ATTENZIONE: Stai spostando un turno tra reparti diversi (${isSourceKitchen ? 'Cucina' : 'Sala'} -> ${isTargetKitchen ? 'Cucina' : 'Sala'}). Continuare?`)) return;
        }

        // --- OPTIMISTIC UPDATE SETUP ---
        const previousSchedule = [...schedule];

        let newSchedule = [...schedule];

        try {
            if (targetAsn && targetAsn.id !== currentAsn.id) {
                // === SWAP ===
                const confirmMsg = `Vuoi scambiare il turno di ${staff.find(s => s.id === currentAsn.staffId)?.nome} con quello di ${targetStaff?.nome}?`;
                if (!confirm(confirmMsg)) return;

                // Optimistic Swap
                newSchedule = newSchedule.map(asn => {
                    if (asn.id === currentAsn.id) {
                        return { ...asn, staffId: newStaffId, data: newDate }; // Move Source to Target
                    }
                    if (asn.id === targetAsn.id) {
                        return { ...asn, staffId: currentAsn.staffId, data: currentAsn.data }; // Move Target to Source
                    }
                    return asn;
                });
                setSchedule(newSchedule);

                // API Calls
                await Promise.all([
                    api.updateAssignment(targetAsn.id, {
                        staffId: currentAsn.staffId,
                        data: currentAsn.data
                    }),
                    api.updateAssignment(currentAsn.id, {
                        staffId: newStaffId,
                        data: newDate
                    })
                ]);

                setToast({ type: 'success', title: 'Turni scambiati!', message: 'Scambio completato.' });

            } else {
                // === MOVE ===
                // Optimistic Move
                newSchedule = newSchedule.map(asn => {
                    if (asn.id === currentAsn.id) {
                        return { ...asn, staffId: newStaffId, data: newDate };
                    }
                    return asn;
                });
                setSchedule(newSchedule);

                await api.updateAssignment(assignmentId, {
                    staffId: newStaffId,
                    data: newDate,
                });
            }
            // Background refresh to ensure consistency/full data (e.g. shifts details)
            // loadData(); // Optional: remove if confident, or keep for safety. Keeping it is safer but might cause flicker if slow.
            // Let's rely on optimistic for immediate feedback and loadData can happen silently or be skipped.
            // Actually, keep loadData for now to sync any server-side logic/validation that might revert stuffs.
            loadData();

        } catch (e: any) {
            console.error("DnD Error:", e);
            setSchedule(previousSchedule); // REVERT
            setToast({ type: 'error', title: 'Errore Spostamento', message: e.message || 'Operazione fallita' });
        }
    };

    const handleContextMenu = (e: React.MouseEvent, asn: Assignment) => {
        if (isReadOnly) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, assignment: asn });
    };

    const handleMenuAction = async (action: string) => {
        if (!contextMenu) return;
        const asn = contextMenu.assignment;

        try {
            if (action === 'delete') {
                if (!confirm('Eliminare questo turno?')) return;
                setSchedule(prev => prev.filter(a => a.id !== asn.id)); // Optimistic
                await api.deleteAssignment(asn.id);
                setToast({ type: 'success', title: 'Turno eliminato', message: '' });
                loadData();
            } else if (action === 'copy') {
                setClipboard(asn);
                setToast({ type: 'info', title: 'Copiato', message: 'Turno copiato negli appunti' });
            } else if (action === 'edit') {
                setEditingCell({
                    shift: asn,
                    staffId: asn.staffId,
                    date: asn.data,
                    type: isLunch(asn.start_time || '') ? 'PRANZO' : 'SERA'
                });
            }
        } catch (e: any) {
            console.error(e);
            alert("Errore azione: " + e.message);
            loadData(); // Revert on error
        } finally {
            setContextMenu(null);
        }
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const isLunch = (time: string) => {
        if (!time) return true;
        const hour = parseInt(time.split(':')[0]);
        return hour < 17;
    };

    async function loadData() {
        setLoading(true);
        try {
            const [schData, stf, tmpl, unavLegacy, bdg, fcst, audit] = await Promise.all([
                api.getSchedule(range.start, range.end),
                api.getStaff(),
                api.getShiftTemplates(),
                api.getUnavailability(range.start, range.end), // Keep fetching separately if needed, or rely on schedule API
                api.getBudget(range.start, range.end),
                api.getForecast(range.start, range.end),
                api.auditSchedule(range.start, range.end).catch(() => []) // Audit silently
            ]);

            let safeSch: any[] = [];
            let safeRequests: any[] = [];
            let safeUnav: any[] = [];

            // Handle new response format vs legacy
            if (Array.isArray(schData)) {
                safeSch = schData;
                safeUnav = Array.isArray(unavLegacy) ? unavLegacy : [];
            } else {
                safeSch = Array.isArray(schData.assignments) ? schData.assignments : [];
                safeRequests = Array.isArray(schData.requests) ? schData.requests : [];
                safeUnav = Array.isArray(schData.unavailabilities) ? schData.unavailabilities : [];
            }

            setSchedule(safeSch);
            setRequests(safeRequests);
            setUnavailabilities(safeUnav);
            setBudgets(Array.isArray(bdg) ? bdg : []);

            const safeStf = Array.isArray(stf) ? stf : [];
            // Sort staff matchin Strict Hierarchy:
            // SALA: Direttore > Vice > JM (Juan last) > [Trainees] > Ops
            // CUCINA: Chef > Manager > Ops
            const getRolePriority = (s: any) => {
                const role = (s.ruolo || '').toLowerCase();
                const name = (s.nome || '').toLowerCase() + ' ' + (s.cognome || '').toLowerCase(); // Concatenate

                // --- SPECIAL OVERRIDES ---
                if (name.includes('luca') && name.includes('gnecco')) return 1; // Director - Absolute Top

                // --- SPECIFIC SORTING REQUESTS ---
                if (name.includes('mamadou')) return 41; // Anchor Mamadou
                if (name.includes('karina') && name.includes('mungolah')) return 42; // Karina immediately after Mamadou

                // --- AREA SALA ---
                // 1. Direttore / Store Manager / RM
                if (role.includes('store') || role.includes('general') || role.includes('titolare') || role.includes('proprietario') || role === 'rm' || role === 'dir') return 10;

                // 2. Vice Direttore
                if (role.includes('vice') || role === 'vrm' || role === 'vd') return 20;

                // 3. Junior Manager
                if (role.includes('junior') || role === 'jm') return 30;

                // 3.1 Juan - Requested to be in Manager section
                if (name.includes('juan')) return 35;

                // 3.5 [Buffer] - In Formazione / Apprendista 
                if (role.includes('formazione') || role.includes('apprendista') || role.includes('training')) return 38;

                // 4. Operatori Sala
                if (role.includes('sala') || role.includes('cameriere') || role.includes('barista') || role.includes('runner') || role.includes('operatore') || role === 'ops' || role === 'op') return 40;

                // 4.5 Supporto Navigli - Requested LAST in Sala section
                if (name.includes('supporto') && name.includes('navigli')) return 48;

                if (role.includes('supporto') || role.includes('extra') || role.includes('stagista') || name.includes('supporto')) return 45; // Extras at bottom of Sala Ops

                // --- AREA CUCINA ---
                // 1. Capo Cucina / Chef
                if (role.includes('chef') || role.includes('capo cucina')) return 50;

                // 2. Manager Cucina
                if (role.includes('manager') && role.includes('cucina')) return 60;

                // Catch-all for Managers not caught above
                if (role.includes('manager') || role.includes('responsabile') || role.includes('direttore')) return 25;

                // 3. Operatori Cucina
                if (role.includes('cucina') || role.includes('cuoco') || role.includes('pizzaiolo') || role.includes('lavapiatti')) return 70;

                // Default fallback (New/Unknown) -> End of list
                return 99;
            };

            safeStf.sort((a: any, b: any) => {
                const pA = getRolePriority(a);
                const pB = getRolePriority(b);

                if (pA !== pB) return pA - pB;

                // Secondary sort: listIndex
                return (a.listIndex ?? 999) - (b.listIndex ?? 999);
            });

            // Attach unavailabilities to staff for easier rendering check
            safeStf.forEach((s: any) => {
                s.unavailabilities = safeUnav.filter((u: any) => u.staffId === s.id);
            });
            setStaff(safeStf);

            setTemplates(Array.isArray(tmpl) ? tmpl : []);
            // setUnavailabilities(Array.isArray(unav) ? unav : []); // Handled above

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

            // --- MISSING SHIFTS CHECK ---
            const auditData = Array.isArray(audit) ? audit : [];
            const missing = auditData.filter((a: any) => a.status === 'MISSING');
            if (missing.length > 0) {
                console.log('⚠️ Missing shifts detected:', missing.length);
                setMissingShifts(missing);
                // setShowMissingModal(true); // Temporarily disabled to avoid annoyance
            } else {
                setMissingShifts([]);
            }

        } catch (error) {
            console.error(error);
            alert("Errore caricamento dati");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, [range]);

    // Load PIT data whenever range changes (only if panel is open)
    const loadPITData = async () => {
        setPitLoading(true);
        try {
            const res = await fetch(`/api/schedule/pit-analysis?start=${range.start}&end=${range.end}`, {
                headers: {
                    'x-user-tenant-key': (currentUser?.tenantKey) ?? '',
                },
            });
            if (res.ok) {
                const data = await res.json();
                setPitData(data);
            }
        } catch (e) {
            console.error('PIT load error:', e);
        } finally {
            setPitLoading(false);
        }
    };

    useEffect(() => {
        if (showPITPanel) loadPITData();
    }, [range, showPITPanel]);

    useEffect(() => {
        const { start, end } = getWeekRange(selectedWeek, currentYear);
        setRange({ start, end, year: currentYear });
        setWeekInput(selectedWeek.toString());
        // Persist last viewed week
        try { localStorage.setItem('calendar_last_week', JSON.stringify({ week: selectedWeek, year: currentYear })); } catch { }
    }, [selectedWeek, currentYear]);

    const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val >= 1 && val <= 53) {
            setSelectedWeek(val);
            setWeekInput(e.target.value);
        } else {
            setWeekInput(e.target.value);
        }
    };

    const handleCellClick = (staffId: number, date: string, type: 'PRANZO' | 'SERA', shift?: Assignment) => {
        if (isReadOnly) return;
        setEditingCell({
            shift: shift,
            staffId,
            date,
            type
        });
    };

    const handleCloseEditor = () => {
        setEditingCell(null);
    };

    const handleSaveShift = async (shiftTemplateId: string | number, start: string, end: string, station: string, note: string) => {
        if (isReadOnly) return;
        try {
            // If all fields empty → delete
            if (!start && !end && !station && !note) {
                if (editingCell?.shift?.id) {
                    await api.deleteAssignment(editingCell.shift.id);
                }
                loadData();
                handleCloseEditor();
                return;
            }

            const payload = {
                shiftTemplateId: shiftTemplateId && shiftTemplateId !== 'MANUAL' ? shiftTemplateId : null,
                start_time: start,
                end_time: end,
                postazione: station,
                note: note,
                staffId: editingCell.staffId,
                data: editingCell.date,
            };

            if (editingCell?.shift?.id) {
                // Update existing
                await api.updateAssignment(editingCell.shift.id, payload);
            } else {
                // Create new
                await api.createAssignment(payload);
            }
            loadData();
            handleCloseEditor();
        } catch (e: any) {
            alert("Errore salvataggio: " + e.message);
        }
    };

    const handleAutoSchedule = async () => {
        if (isReadOnly) return;
        if (!confirm("Generare turni automatici per questa settimana? Sovrascriverà i turni esistenti.")) return;
        setLoading(true);
        try {
            const result = await api.generateSchedule(range.start, range.end);
            const missed: any[] = Array.isArray(result?.unassigned) ? result.unassigned : [];
            setMissingShifts(missed);
            if (missed.length > 0) {
                setToast({
                    type: 'warning',
                    title: `⚠️ ${missed.length} turni non coperti`,
                    message: 'Scorri in basso per vedere i dettagli'
                });
            } else {
                setToast({ type: 'success', title: 'Programmazione completata!', message: `${result?.count ?? 0} turni assegnati.` });
            }
            loadData();
        } catch (e: any) {
            setToast({ type: 'error', title: 'Errore generazione', message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleClearSchedule = async () => {
        if (isReadOnly) return;
        if (!confirm("ATTENZIONE: Cancellare TUTTI i turni di questa settimana?")) return;
        setLoading(true);
        try {
            await api.clearAssignments(range.start, range.end);
            alert("Turni cancellati.");
            loadData();
        } catch (e: any) {
            alert("Errore cancellazione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Helper to get shift ---
    const getShift = (staffId: number, date: string, type: 'PRANZO' | 'SERA') => {
        return schedule.find(a => {
            if (a.staffId !== staffId || a.data !== date) return false;
            if (type === 'PRANZO' && isLunch(a.start_time || '')) return true;
            if (type === 'SERA' && !isLunch(a.start_time || '')) return true;
            return false;
        });
    };

    // --- Calculate Hours ---
    const calcHours = (start: string, end: string) => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
        if (diff < 0) diff += 24;
        return diff;
    };

    // --- Generate Dates Header ---
    const days = getDatesInRange(range.start, range.end);

    // --- Group Staff by Role/Department for better visualization ---
    const staffGroups = [
        {
            title: 'MANAGER',
            icon: '👔',
            filter: (s: Staff) => {
                const r = s.ruolo.toLowerCase();
                return (r.includes('titolare') || r.includes('general') || r.includes('store') || r.includes('direttore') || r.includes('vice') || r.includes('manager') || r.includes('junior') || r === 'jm' || r === 'rm' || r === 'vrm' || r === 'vd' || r === 'dir') && !r.includes('cucina');
            },
            bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-300',
            headerBg: 'bg-indigo-100', headerBorder: 'border-indigo-400', accentColor: '#4f46e5'
        },
        {
            title: 'SALA',
            icon: '🍽️',
            filter: (s: Staff) => {
                const r = s.ruolo.toLowerCase();
                return (r.includes('sala') || r.includes('cameriere') || r.includes('barista') || r.includes('runner') || r.includes('operatore') || r.includes('cassa') || r.includes('accoglienza') || r.includes('hostess') || r.includes('jolly') || r.includes('supporto') || r.includes('extra') || r.includes('stagista') || r.includes('formazione') || r.includes('apprendista')) && !r.includes('manager') && !r.includes('direttore') && !r.includes('vice') && !r.includes('cucina');
            },
            bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-300',
            headerBg: 'bg-sky-100', headerBorder: 'border-sky-400', accentColor: '#0284c7'
        },
        {
            title: 'CUCINA',
            icon: '👨‍🍳',
            filter: (s: Staff) => {
                const r = s.ruolo.toLowerCase();
                return r.includes('cucina') || r.includes('chef') || r.includes('cuoco') || r.includes('pizzaiolo') || r.includes('lavapiatti') || r.includes('plonge') || r.includes('griglia') || r.includes('aiuto');
            },
            bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300',
            headerBg: 'bg-amber-100', headerBorder: 'border-amber-400', accentColor: '#d97706'
        },
        {
            title: 'ALTRO',
            icon: '👤',
            filter: (s: Staff) => true,
            bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300',
            headerBg: 'bg-gray-100', headerBorder: 'border-gray-400', accentColor: '#6b7280'
        }
    ];

    // Helper to distribute staff into groups without duplication
    const groupedStaff: { group: any, staff: Staff[] }[] = [];
    let assignedStaffIds = new Set<number>();

    staffGroups.forEach(g => {
        const groupStaff = staff.filter(s => !assignedStaffIds.has(s.id) && g.filter(s));
        if (groupStaff.length > 0) {
            groupedStaff.push({ group: g, staff: groupStaff });
            groupStaff.forEach(s => assignedStaffIds.add(s.id));
        }
    });

    const handlePaste = async () => {
        if (isReadOnly) return;
        if (!clipboard) {
            alert("Nessun turno copiato.");
            return;
        }
        if (!editingCell) { // Paste needs a target. This logic is a bit weak for button click. 
            // Better: Context menu 'Paste' on empty cell? 
            // For now, let's assume paste copies to the LAST clicked cell or hovered?
            // Actually, we need a target.
            alert("Usa il tasto destro su una cella vuota per incollare (Work in Progress).");
            return;
        }
    };

    // Calculate Weekly Stats for Header
    const totalAssignedHours = schedule.reduce((acc, curr) => acc + (curr.start_time && curr.end_time ? calcHours(curr.start_time, curr.end_time) : 0), 0);
    const totalBudgetHours = budgets.reduce((acc, b) => acc + (b.hoursLunchHall || 0) + (b.hoursDinnerHall || 0) + (b.hoursLunchKitchen || 0) + (b.hoursDinnerKitchen || 0), 0);
    const budgetDiffTotal = totalAssignedHours - totalBudgetHours;

    // --- ZOOM STYLE ---
    // Instead of transform scale (which blurs), let's use font-size and padding scaling
    // Or just a wrapper scale for simplicity
    const zoomStyle = {
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        width: `${100 / zoom}%` // Compensate width
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY * -0.001; // Slower scroll
            setZoom(prev => Math.min(Math.max(0.6, prev + delta), 1.5));
        }
    };

    return (
        <DndContext
            sensors={sensors}
            onDragEnd={handleDragEnd}
            onDragStart={(e) => setDragActiveId(Number(e.active.id.toString().replace('shift-', '')))}
        >
            <div className="flex flex-col min-h-screen bg-gray-50 p-4" onWheel={handleWheel}>
                {/* --- HEADER --- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors">
                                <RotateCcw size={20} />
                            </Link>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                <LayoutGrid className="text-indigo-600" size={28} />
                                PLANNING
                            </h1>
                        </div>
                        <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                            Settimana <span className="font-bold text-indigo-600 text-lg">#{selectedWeek}</span>
                            <span className="text-gray-300">|</span>
                            <span className="capitalize">{new Date(range.start).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} - {new Date(range.end).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span>
                        </p>
                    </div>

                    {/* CONTROLS */}
                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200 shadow-sm">
                        <button onClick={() => {
                            const prev = selectedWeek - 1;
                            if (prev >= 1) setSelectedWeek(prev);
                            else { setCurrentYear(currentYear - 1); setSelectedWeek(52); }
                        }} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-gray-600">
                            <ChevronLeft size={20} />
                        </button>

                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-gray-100">

                            {/* YEAR SELECTOR */}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Anno</span>
                                <div className="relative">
                                    <select
                                        value={currentYear}
                                        onChange={(e) => setCurrentYear(Number(e.target.value))}
                                        className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-20 p-2 pr-8 font-bold cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="h-8 w-px bg-gray-200"></div>

                            {/* WEEK SELECTOR */}
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Settimana</span>
                                <input
                                    type="number"
                                    value={weekInput}
                                    onChange={handleWeekChange}
                                    className="w-12 text-center font-bold text-gray-900 bg-transparent outline-none border-b-2 border-transparent focus:border-indigo-500 transition-colors"
                                />
                            </div>
                        </div>

                        <button onClick={() => {
                            const next = selectedWeek + 1;
                            if (next <= 53) setSelectedWeek(next);
                            else { setCurrentYear(currentYear + 1); setSelectedWeek(1); }
                        }} className="p-2 hover:bg-white hover:shadow rounded-lg transition-all text-gray-600">
                            <ChevronRight size={20} />
                        </button>

                        <div className="h-8 w-px bg-gray-300 mx-2"></div>

                        <div className="flex items-center gap-1">
                            <button onClick={() => setZoom(z => Math.max(0.6, z - 0.1))} className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg transition-all text-gray-500" title="Zoom Out">
                                <ZoomOut size={18} />
                            </button>
                            <span className="text-xs font-mono text-gray-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg transition-all text-gray-500" title="Zoom In">
                                <ZoomIn size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    {!isReadOnly && (
                        <div className="flex items-center gap-2">
                            {/* Broadcast Email — secondary/outline */}
                            <button
                                onClick={handleBroadcast}
                                disabled={sendingEmail}
                                className={`flex items-center gap-2 bg-white text-gray-600 border border-gray-200 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium ${sendingEmail ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Invia turni via email a tutti"
                            >
                                <Mail size={16} />
                                {sendingEmail ? 'Inviando…' : 'Email'}
                            </button>

                            <button
                                onClick={() => setShowReorderModal(true)}
                                className="bg-white text-gray-500 border border-gray-200 p-2 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                                title="Riordina Staff"
                            >
                                <Target size={16} />
                            </button>

                            {showReorderModal && (
                                <StaffReorderModal
                                    staff={staff}
                                    onClose={() => setShowReorderModal(false)}
                                    onSave={loadData}
                                />
                            )}

                            {/* AI Train — secondary accent */}
                            <button
                                onClick={handleTrainAI}
                                disabled={loading}
                                className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-3 py-2 rounded-xl shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all text-sm font-medium"
                                title="Addestra AI su questa settimana"
                            >
                                <Brain size={16} className={loading ? 'animate-pulse' : ''} />
                                <span className="hidden sm:inline">Addestra AI</span>
                            </button>

                            <div className="h-6 w-px bg-gray-200" />

                            {/* Auto — PRIMARY action */}
                            <button
                                onClick={handleAutoSchedule}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-md hover:bg-indigo-500 hover:shadow-lg transition-all font-semibold text-sm"
                            >
                                <Wand2 size={16} />
                                <span className="hidden sm:inline">Auto</span>
                            </button>

                            {/* PIT toggle */}
                            <button
                                onClick={() => setShowPITPanel(p => !p)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-medium ${showPITPanel
                                    ? 'bg-violet-600 text-white border-violet-700 shadow-md'
                                    : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50'
                                    }`}
                                title="Analisi PIT"
                            >
                                <Zap size={16} />
                                <span className="hidden sm:inline">PIT</span>
                            </button>

                            <button onClick={handleClearSchedule} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </div>

                {/* --- STATS BAR --- */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* Ore Assegnate */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Ore Assegnate</p>
                            <p className="text-3xl font-black text-indigo-900 leading-none">
                                {totalAssignedHours.toLocaleString('it-IT')}
                                <span className="text-base font-medium text-gray-400 ml-1">h</span>
                            </p>
                        </div>
                        <Clock className="text-indigo-100" size={36} />
                    </div>
                    {/* Budget Ore */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Budget Ore</p>
                            <p className="text-3xl font-black text-gray-700 leading-none">
                                {totalBudgetHours.toLocaleString('it-IT')}
                                <span className="text-base font-medium text-gray-400 ml-1">h</span>
                            </p>
                        </div>
                        <BarChart3 className="text-gray-100" size={36} />
                    </div>
                    {/* Scostamento: positive = over-budget (red), negative = under-budget (emerald) */}
                    <div className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between ${budgetDiffTotal > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                        }`}>
                        <div>
                            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${budgetDiffTotal > 0 ? 'text-rose-500' : 'text-emerald-500'
                                }`}>Scostamento</p>
                            <p className={`text-3xl font-black leading-none ${budgetDiffTotal > 0 ? 'text-rose-700' : 'text-emerald-700'
                                }`}>
                                {budgetDiffTotal > 0 ? '+' : ''}{budgetDiffTotal.toLocaleString('it-IT')}
                                <span className="text-base font-medium opacity-60 ml-1">h</span>
                            </p>
                        </div>
                        <TrendingUp className={budgetDiffTotal > 0 ? 'text-rose-200' : 'text-emerald-200'} size={36} />
                    </div>
                </div>

                {/* --- PIT ANALYSIS PANEL --- */}
                {showPITPanel && (
                    <PITAnalysisPanel
                        data={pitData}
                        loading={pitLoading}
                        onRegenerateWithPIT={!isReadOnly ? () => {
                            setShowPITPanel(false);
                            handleAutoSchedule();
                        } : undefined}
                    />
                )}

                {/* --- QUICK FILTER BAR --- */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Filtro:</span>
                    {[null, 'MANAGER', 'SALA', 'CUCINA'].map((area) => {
                        const labels: Record<string, string> = { 'MANAGER': '👔 Manager', 'SALA': '🍽️ Sala', 'CUCINA': '👨‍🍳 Cucina' };
                        const colors: Record<string, string> = {
                            'MANAGER': 'bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200',
                            'SALA': 'bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200',
                            'CUCINA': 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
                        };
                        const isActive = filterArea === area;
                        const label = area ? labels[area] : '🌐 Tutti';
                        const colorClass = area ? colors[area] : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50';
                        return (
                            <button
                                key={area ?? 'all'}
                                onClick={() => setFilterArea(area)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${isActive ? `${colorClass} ring-2 ring-offset-1 ${area ? 'ring-' + (area === 'MANAGER' ? 'indigo' : area === 'SALA' ? 'sky' : 'amber') + '-400' : 'ring-gray-300'}` : colorClass
                                    }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* --- CALENDAR GRID --- */}
                <div className="overflow-auto border border-gray-200 rounded-xl shadow-sm bg-white relative" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    <div style={zoomStyle} className="min-w-[1200px]">
                        <table className="w-full text-sm border-collapse">
                            <thead className="sticky top-0 z-30 bg-white shadow-sm ring-1 ring-black/5">
                                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                    <th className="sticky left-0 bg-gray-50 p-2 border-r border-gray-200 w-10 z-40 text-gray-400">#</th>
                                    <th className="sticky left-[40px] bg-gray-50 p-2 border-r border-gray-200 text-left w-[160px] z-40 text-gray-600">Dipendente</th>
                                    {days.map(d => {
                                        const dt = new Date(d);
                                        const today = new Date().toISOString().slice(0, 10);
                                        const isToday = d === today;
                                        const dow = dt.getDay(); // 0=Sun, 6=Sat
                                        const isWeekend = dow === 0 || dow === 6;
                                        const dayLabel = dt.toLocaleDateString('it-IT', { weekday: 'short' });
                                        const dateLabel = dt.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
                                        return (
                                            <th key={d} className={`border-r border-gray-200 text-center p-0 relative group/col ${isWeekend ? 'bg-amber-50/60' : ''}`} colSpan={2} style={{ minWidth: colWidth, width: colWidth }}>
                                                <div className={`p-2 border-b flex flex-col items-center gap-0.5 ${isToday ? 'bg-indigo-600 text-white border-indigo-700' : isWeekend ? 'bg-amber-100 border-amber-200 text-amber-900' : 'bg-gray-100 border-gray-200 text-gray-800'}`}>
                                                    <span className={`font-black uppercase text-[11px] tracking-widest ${isToday ? 'text-indigo-100' : isWeekend ? 'text-amber-600' : 'text-gray-500'}`}>{dayLabel}</span>
                                                    <span className={`font-bold text-sm leading-tight ${isToday ? 'text-white' : isWeekend ? 'text-amber-900' : 'text-gray-800'}`}>{dateLabel}</span>
                                                    {isToday && <span className="text-[9px] bg-white text-indigo-600 rounded-full px-1.5 font-black uppercase tracking-wider mt-0.5">Oggi</span>}
                                                </div>
                                                <div className={`grid grid-cols-2 text-[10px] items-center divide-x divide-gray-100 ${isWeekend ? 'bg-amber-50/40' : 'bg-white'}`}>
                                                    <div className={`text-center py-1 font-bold ${isToday ? 'text-indigo-500' : 'text-orange-400'} bg-orange-50/20`}>T1</div>
                                                    <div className={`text-center py-1 font-bold ${isToday ? 'text-indigo-400' : 'text-slate-400'} bg-slate-50/20`}>T2</div>
                                                </div>
                                                {/* Resize handle */}
                                                <div
                                                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize flex items-center justify-center opacity-0 group-hover/col:opacity-100 transition-opacity z-50"
                                                    onMouseDown={startColResize}
                                                    onTouchStart={startColResize}
                                                    title="Trascina per ridimensionare"
                                                >
                                                    <div className="w-0.5 h-6 bg-indigo-400 rounded-full" />
                                                </div>
                                            </th>
                                        );
                                    })}
                                    <th className="p-2 border-r border-gray-200 w-16 bg-gray-50 text-center text-gray-500" title="Ore totali settimana">Tot.</th>
                                    <th className="p-2 border-r border-gray-200 w-16 bg-gray-50 text-center text-gray-500" title="Ore massime contratto">Max</th>
                                    <th className="p-2 w-16 bg-gray-50 text-center text-gray-500" title="Differenza ore">Diff</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {groupedStaff
                                    .filter(g => !filterArea || g.group.title === filterArea)
                                    .map((group, gIdx) => {
                                        const isCollapsed = collapsedGroups.has(group.group.title);
                                        // Compute total hours for this group across the week
                                        const groupTotalHours = group.staff.reduce((acc, s) => {
                                            days.forEach(d => {
                                                const l = getShift(s.id, d, 'PRANZO');
                                                const dn = getShift(s.id, d, 'SERA');
                                                if (l?.start_time && l?.end_time) acc += calcHours(l.start_time, l.end_time);
                                                if (dn?.start_time && dn?.end_time) acc += calcHours(dn.start_time, dn.end_time);
                                            });
                                            return acc;
                                        }, 0);
                                        return (
                                            <React.Fragment key={gIdx}>
                                                {/* Section Header */}
                                                <tr
                                                    className={`${group.group.headerBg} border-y-2 ${group.group.headerBorder} cursor-pointer select-none`}
                                                    onClick={() => toggleGroup(group.group.title)}
                                                >
                                                    <td colSpan={20} className={`p-0`}>
                                                        <div className={`flex items-center gap-3 px-3 py-2 ${group.group.text}`}>
                                                            <span className="text-base leading-none">{group.group.icon}</span>
                                                            <span className="font-black uppercase tracking-widest text-xs flex-1">
                                                                {group.group.title}
                                                            </span>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${group.group.border} ${group.group.bg}`}>
                                                                {group.staff.length} persone
                                                            </span>
                                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${group.group.bg} ${group.group.text} border ${group.group.border} ml-1`}>
                                                                {groupTotalHours.toLocaleString('it-IT', { maximumFractionDigits: 1 })}h sett.
                                                            </span>
                                                            <span className="text-[11px] opacity-60 font-mono ml-1">
                                                                {isCollapsed ? '▶' : '▼'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Staff Rows */}
                                                {group.staff.map((s, idx) => {
                                                    let totalHours = 0;
                                                    days.forEach(d => {
                                                        const l = getShift(s.id, d, 'PRANZO');
                                                        const dn = getShift(s.id, d, 'SERA');
                                                        if (l && l.start_time && l.end_time) totalHours += calcHours(l.start_time, l.end_time);
                                                        if (dn && dn.start_time && dn.end_time) totalHours += calcHours(dn.start_time, dn.end_time);
                                                    });
                                                    const budgetDiff = totalHours - (s.oreMassime || 0);
                                                    const diffColor = budgetDiff > 2 ? 'text-red-600 bg-red-50 font-black' : (budgetDiff < -2 ? 'text-blue-600 bg-blue-50 font-bold' : 'text-emerald-600 bg-emerald-50 font-bold');
                                                    const isEven = idx % 2 === 0;

                                                    if (isCollapsed) return null;
                                                    return (
                                                        <tr key={s.id} className={`border-b border-gray-100 group h-[52px] transition-colors duration-100 ${isEven ? 'bg-white' : 'bg-gray-50/40'} hover:bg-indigo-50/30`}>
                                                            {/* # */}
                                                            <td className="sticky left-0 border-r border-gray-200 p-2 text-center text-gray-400 group-hover:bg-indigo-50/40 z-10 font-mono text-[10px] transition-colors" style={{ background: 'inherit' }}>{s.listIndex || idx + 1}</td>
                                                            {/* Name */}
                                                            <td className="sticky left-[40px] border-r-2 border-gray-300 p-2 font-bold text-gray-900 text-left group-hover:bg-indigo-50/40 z-10 max-w-[200px] transition-colors" style={{ background: 'inherit', borderLeft: `3px solid ${group.group.accentColor || '#6366f1'}` }}>
                                                                <div className="truncate font-black text-[11px] leading-tight text-gray-900 uppercase">{s.nome} {s.cognome}</div>
                                                                {s.ruolo && <div className="text-[9px] font-semibold uppercase tracking-wide mt-0.5 truncate" style={{ color: group.group.accentColor || '#6366f1', opacity: 0.8 }}>{s.ruolo}</div>}
                                                            </td>

                                                            {/* Empty cell placeholders & shift slots */}
                                                            {days.map((d) => {
                                                                const lunch = getShift(s.id, d, 'PRANZO');
                                                                const dinner = getShift(s.id, d, 'SERA');
                                                                const dt = new Date(d);
                                                                const dow = dt.getDay();
                                                                const isWeekend = dow === 0 || dow === 6;
                                                                const today = new Date().toISOString().slice(0, 10);
                                                                const isToday = d === today;
                                                                const cellBg = isToday ? 'bg-indigo-50/20' : isWeekend ? 'bg-amber-50/20' : '';

                                                                let absenceBadge = null;
                                                                if (!lunch && !dinner) {
                                                                    const req = requests.find((r: any) => r.staffId === s.id && r.data === d && r.status === 'APPROVED');
                                                                    if (req) {
                                                                        const label = req.tipo === 'FERIE' ? 'FERIE' : req.tipo === 'MALATTIA' ? 'MALATTIA' : req.tipo === 'PERMESSO' ? 'PERMESSO' : 'ASSENZA';
                                                                        const colorClass = req.tipo === 'FERIE' ? 'bg-teal-100 text-teal-800 border-teal-200' :
                                                                            req.tipo === 'MALATTIA' ? 'bg-red-100 text-red-800 border-red-200' :
                                                                                'bg-orange-100 text-orange-800 border-orange-200';
                                                                        absenceBadge = (
                                                                            <div className={`
                                                                    absolute inset-x-2 top-1/2 -translate-y-1/2 
                                                                    px-2 py-1 rounded-md border text-xs font-bold text-center shadow-sm uppercase tracking-wider
                                                                    ${colorClass} z-20 pointer-events-none
                                                                `}>
                                                                                {label}
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        const unav = unavailabilities.find((u: any) => u.staffId === s.id && u.data === d);
                                                                        if (unav) {
                                                                            absenceBadge = (
                                                                                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md border bg-gray-100 text-gray-600 border-gray-200 text-xs font-bold text-center uppercase tracking-wider z-20 pointer-events-none">
                                                                                    NON DISP.
                                                                                </div>
                                                                            );
                                                                        }
                                                                    }
                                                                }

                                                                return (
                                                                    <React.Fragment key={d}>
                                                                        <DroppableCell staffId={s.id} date={d} type="PRANZO" className={cellBg}>
                                                                            {lunch ? (
                                                                                <DraggableShiftItem
                                                                                    assignment={{ ...lunch, _groupAccent: group.group.title }}
                                                                                    type="PRANZO"
                                                                                    onUpdate={(id, val) => api.updateAssignment(id, val).then(loadData).catch(e => alert(e.message))}
                                                                                    onContextMenu={handleContextMenu}
                                                                                />
                                                                            ) : (
                                                                                <>
                                                                                    <div
                                                                                        className={`w-full h-full min-h-[40px] cursor-pointer transition-colors group/empty flex items-center justify-center ${cellBg} hover:bg-indigo-100/40`}
                                                                                        onClick={() => handleCellClick(s.id, d, 'PRANZO', undefined)}
                                                                                        title="Clicca per aggiungere turno"
                                                                                    >
                                                                                        <span className="opacity-0 group-hover/empty:opacity-30 text-indigo-400 text-lg leading-none font-thin select-none">+</span>
                                                                                    </div>
                                                                                    {absenceBadge}
                                                                                </>
                                                                            )}
                                                                        </DroppableCell>
                                                                        <DroppableCell staffId={s.id} date={d} type="SERA" className={`border-r-2 border-gray-300 ${cellBg}`}>
                                                                            {dinner ? (
                                                                                <DraggableShiftItem
                                                                                    assignment={{ ...dinner, _groupAccent: group.group.title }}
                                                                                    type="SERA"
                                                                                    onUpdate={(id, val) => api.updateAssignment(id, val).then(loadData).catch(e => alert(e.message))}
                                                                                    onContextMenu={handleContextMenu}
                                                                                />
                                                                            ) : (
                                                                                <div
                                                                                    className={`w-full h-full min-h-[40px] cursor-pointer transition-colors group/empty flex items-center justify-center ${cellBg} hover:bg-indigo-100/40`}
                                                                                    onClick={() => handleCellClick(s.id, d, 'SERA', undefined)}
                                                                                    title="Clicca per aggiungere turno"
                                                                                >
                                                                                    <span className="opacity-0 group-hover/empty:opacity-30 text-indigo-400 text-lg leading-none font-thin select-none">+</span>
                                                                                </div>
                                                                            )}
                                                                        </DroppableCell>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                            {/* Summary cols */}
                                                            <td className="border-r border-gray-200 p-1.5 text-center text-xs font-bold text-gray-700 bg-gray-50/50 tabular-nums">{totalHours.toFixed(1)}h</td>
                                                            <td className="border-r border-gray-200 p-1.5 text-center text-xs text-gray-400 tabular-nums">{s.oreMassime ? `${s.oreMassime}h` : '—'}</td>
                                                            <td className={`p-1.5 text-center text-xs rounded-sm ${diffColor} tabular-nums`}>{budgetDiff >= 0 ? '+' : ''}{budgetDiff.toFixed(1)}h</td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                            </tbody>

                            {!isReadOnly && (
                                <tfoot className="bg-white font-sans border-t border-indigo-100 text-xs">
                                    {/* Row 1: Budget Ore SALA */}
                                    <tr className="bg-indigo-50 border-t border-indigo-100">
                                        <td className="sticky left-0 p-2 bg-indigo-50 font-bold text-indigo-900 text-right" colSpan={2}>Budget Ore SALA</td>
                                        {days.map((d, i) => {
                                            const b = budgets.find((x: any) => x.data === d) || {};
                                            return (
                                                <React.Fragment key={i}>
                                                    <td className="p-2 text-center border-r border-indigo-100 text-indigo-700 bg-indigo-50 min-w-[60px]">{b.hoursLunchHall > 0 ? b.hoursLunchHall.toFixed(1) : '-'}</td>
                                                    <td className="p-2 text-center border-r border-indigo-100 text-indigo-700 bg-indigo-50 min-w-[60px]">{b.hoursDinnerHall > 0 ? b.hoursDinnerHall.toFixed(1) : '-'}</td>
                                                </React.Fragment>
                                            )
                                        })}
                                        {/* Weekly Total */}
                                        <td className="p-2 text-center font-bold text-indigo-900 border-l border-indigo-200">
                                            {budgets.reduce((acc, b) => acc + (b.hoursLunchHall || 0) + (b.hoursDinnerHall || 0), 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })}
                                        </td>
                                        <td colSpan={2} className="bg-indigo-50 border-t border-indigo-100"></td>
                                    </tr>

                                    {/* Row 2: Budget Ore CUCINA */}
                                    <tr className="bg-orange-50 border-t border-orange-100">
                                        <td className="sticky left-0 p-2 bg-orange-50 font-bold text-orange-900 text-right" colSpan={2}>Budget Ore CUCINA</td>
                                        {days.map((d, i) => {
                                            const b = budgets.find((x: any) => x.data === d) || {};
                                            return (
                                                <React.Fragment key={i}>
                                                    <td className="p-2 text-center border-r border-orange-100 text-orange-700 bg-orange-50 min-w-[60px]">{b.hoursLunchKitchen > 0 ? b.hoursLunchKitchen.toFixed(1) : '-'}</td>
                                                    <td className="p-2 text-center border-r border-orange-100 text-orange-700 bg-orange-50 min-w-[60px]">{b.hoursDinnerKitchen > 0 ? b.hoursDinnerKitchen.toFixed(1) : '-'}</td>
                                                </React.Fragment>
                                            )
                                        })}
                                        {/* Weekly Total */}
                                        <td className="p-2 text-center font-bold text-orange-900 border-l border-orange-200">
                                            {budgets.reduce((acc, b) => acc + (b.hoursLunchKitchen || 0) + (b.hoursDinnerKitchen || 0), 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })}
                                        </td>
                                        <td colSpan={2} className="bg-orange-50 border-t border-orange-100"></td>
                                    </tr>

                                    {/* Detailed Hours Breakdown */}
                                    {[
                                        { label: 'ORE SALA', dept: 'SALA', color: 'bg-orange-50 text-orange-800' },
                                        { label: 'ORE CUCINA', dept: 'CUCINA', color: 'bg-yellow-50 text-yellow-800' },
                                    ].map((row, idx) => (
                                        <tr key={idx} className={`${row.color} border-t border-slate-200`}>
                                            <td className={`sticky left-0 p-2 font-bold text-right text-xs uppercase ${row.color}`} colSpan={2}>{row.label}</td>
                                            {days.map((d, i) => {
                                                // Calculate Pranzo
                                                const totalP = staff.reduce((acc, s) => {
                                                    const shift = getShift(s.id, d, 'PRANZO');
                                                    if (shift?.start_time && shift?.end_time) {
                                                        const cat = (() => {
                                                            const post = (shift.postazione || '').toUpperCase();
                                                            const role = (s.ruolo || '').toUpperCase();
                                                            const CUCINA_KEYS = ['FRITTI', 'DOLCI', 'PREPARAZIONE', 'LAVAGGIO', 'GRIGLIA', 'CUCINA', 'PIRA', 'BURGER', 'PLONGE', 'CUOCO', 'CHEF', 'PIZZAIOLO', 'AIUTO', 'LAVAPIATTI'];
                                                            const SALA_KEYS = ['SALA', 'CAMERIERE', 'BAR', 'RUNNER', 'RESPONSABILE', 'DIRETTORE', 'ACCOGLIENZA', 'HOSTESS', 'CASSA'];

                                                            if (CUCINA_KEYS.some(k => post.includes(k) || role.includes(k))) return 'CUCINA';
                                                            if (SALA_KEYS.some(k => post.includes(k) || role.includes(k))) return 'SALA';
                                                            return 'SALA';
                                                        })();
                                                        if (cat === row.dept) return acc + calcHours(shift.start_time, shift.end_time);
                                                    }
                                                    return acc;
                                                }, 0);

                                                // Calculate Cena
                                                const totalC = staff.reduce((acc, s) => {
                                                    const shift = getShift(s.id, d, 'SERA');
                                                    if (shift?.start_time && shift?.end_time) {
                                                        const cat = (() => {
                                                            const post = (shift.postazione || '').toUpperCase();
                                                            const role = (s.ruolo || '').toUpperCase();
                                                            const CUCINA_KEYS = ['FRITTI', 'DOLCI', 'PREPARAZIONE', 'LAVAGGIO', 'GRIGLIA', 'CUCINA', 'PIRA', 'BURGER', 'PLONGE', 'CUOCO', 'CHEF', 'PIZZAIOLO', 'AIUTO', 'LAVAPIATTI'];
                                                            const SALA_KEYS = ['SALA', 'CAMERIERE', 'BAR', 'RUNNER', 'RESPONSABILE', 'DIRETTORE', 'ACCOGLIENZA', 'HOSTESS', 'CASSA'];

                                                            if (CUCINA_KEYS.some(k => post.includes(k) || role.includes(k))) return 'CUCINA';
                                                            if (SALA_KEYS.some(k => post.includes(k) || role.includes(k))) return 'SALA';
                                                            return 'SALA';
                                                        })();
                                                        if (cat === row.dept) return acc + calcHours(shift.start_time, shift.end_time);
                                                    }
                                                    return acc;
                                                }, 0);

                                                return (
                                                    <React.Fragment key={i}>
                                                        <td className="p-2 text-center border-r border-slate-200 text-xs font-medium border-r-slate-300">
                                                            {totalP > 0 ? totalP.toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '-'}
                                                        </td>
                                                        <td className="p-2 text-center border-r border-slate-200 text-xs font-medium border-r-gray-400">
                                                            {totalC > 0 ? totalC.toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '-'}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            {/* Weekly Total */}
                                            <td className="p-2 text-center font-bold border-l border-slate-200 text-xs">
                                                {(() => {
                                                    let wTotal = 0;
                                                    days.forEach(d => {
                                                        staff.forEach(s => {
                                                            ['PRANZO', 'SERA'].forEach(type => {
                                                                const shift = getShift(s.id, d, type as 'PRANZO' | 'SERA');
                                                                if (shift?.start_time && shift?.end_time) {
                                                                    const cat = (() => {
                                                                        const post = (shift.postazione || '').toUpperCase();
                                                                        const role = (s.ruolo || '').toUpperCase();
                                                                        const CUCINA_KEYS = ['FRITTI', 'DOLCI', 'PREPARAZIONE', 'LAVAGGIO', 'GRIGLIA', 'CUCINA', 'PIRA', 'BURGER', 'PLONGE', 'CUOCO', 'CHEF', 'PIZZAIOLO', 'AIUTO', 'LAVAPIATTI'];
                                                                        const SALA_KEYS = ['SALA', 'CAMERIERE', 'BAR', 'RUNNER', 'RESPONSABILE', 'DIRETTORE', 'ACCOGLIENZA', 'HOSTESS', 'CASSA'];

                                                                        if (CUCINA_KEYS.some(k => post.includes(k) || role.includes(k))) return 'CUCINA';
                                                                        if (SALA_KEYS.some(k => post.includes(k) || role.includes(k))) return 'SALA';
                                                                        return 'SALA';
                                                                    })();
                                                                    if (cat === row.dept) {
                                                                        wTotal += calcHours(shift.start_time, shift.end_time);
                                                                    }
                                                                }
                                                            });
                                                        });
                                                    });
                                                    return wTotal > 0 ? wTotal.toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '-';
                                                })()}
                                            </td>
                                            <td colSpan={2} className={`${row.color}`}></td>
                                        </tr>
                                    ))}


                                    {/* Row 4: Totale Ore (Updated for Alignment) */}
                                    <tr className="bg-orange-100 border-t border-orange-200">
                                        <td className="sticky left-0 p-2 bg-orange-100 font-bold text-orange-900 text-right" colSpan={2}>ORE TOTALI</td>
                                        {days.map((d, i) => {
                                            const total = (() => {
                                                let total = 0;
                                                staff.forEach(s => {
                                                    const sl = getShift(s.id, d, 'PRANZO');
                                                    const sdn = getShift(s.id, d, 'SERA');
                                                    if (sl?.start_time && sl?.end_time) total += calcHours(sl.start_time, sl.end_time);
                                                    if (sdn?.start_time && sdn?.end_time) total += calcHours(sdn.start_time, sdn.end_time);
                                                });
                                                return total;
                                            })();

                                            // Render with colSpan=2 to span both PRANZO and CENA columns for the Day
                                            return (
                                                <td key={i} colSpan={2} className="p-2 text-center border-r border-orange-200 font-bold text-orange-800">
                                                    {total > 0 ? total.toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '-'}
                                                </td>
                                            );
                                        })}
                                        <td className="p-2 text-center font-black text-orange-800 border-l border-orange-200">
                                            {/* Weekly Total All */}
                                            {(() => {
                                                let total = 0;
                                                days.forEach(d => {
                                                    staff.forEach(s => {
                                                        const sl = getShift(s.id, d, 'PRANZO');
                                                        const sdn = getShift(s.id, d, 'SERA');
                                                        if (sl?.start_time && sl?.end_time) total += calcHours(sl.start_time, sl.end_time);
                                                        if (sdn?.start_time && sdn?.end_time) total += calcHours(sdn.start_time, sdn.end_time);
                                                    });
                                                });
                                                return total.toLocaleString('it-IT', { maximumFractionDigits: 1 });
                                            })()}
                                        </td>
                                        <td colSpan={2} className="bg-orange-100 border-t border-orange-200"></td>
                                    </tr>

                                    {/* Row 5: Produttività */}
                                    <tr className="bg-purple-50 border-t border-purple-100">
                                        <td className="sticky left-0 p-2 bg-purple-50 font-bold text-purple-900 text-right" colSpan={2}>PRODUTTIVITÀ (€/h)</td>
                                        {days.map((d, i) => {
                                            // Calculate Total Real Hours (Sala + Cucina)
                                            let l = 0, dn = 0;
                                            staff.forEach(s => {
                                                const sl = getShift(s.id, d, 'PRANZO');
                                                const sdn = getShift(s.id, d, 'SERA');
                                                if (sl?.start_time && sl?.end_time) l += calcHours(sl.start_time, sl.end_time);
                                                if (sdn?.start_time && sdn?.end_time) dn += calcHours(sdn.start_time, sdn.end_time);
                                            });

                                            // Get Revenue from Budget
                                            const b = budgets.find((x: any) => x.data === d) || {};
                                            const revL = b.valueLunch || 0;
                                            const revD = b.valueDinner || 0;

                                            const prodL = l > 0 ? revL / l : 0;
                                            const prodD = dn > 0 ? revD / dn : 0;

                                            return (
                                                <React.Fragment key={i}>
                                                    <td className="p-2 text-center border-r border-purple-200 font-black text-purple-700 min-w-[60px]">
                                                        {prodL > 0 ? `€${prodL.toFixed(0)}` : '-'}
                                                    </td>
                                                    <td className="p-2 text-center border-r border-purple-200 font-black text-purple-700 min-w-[60px]">
                                                        {prodD > 0 ? `€${prodD.toFixed(0)}` : '-'}
                                                    </td>
                                                </React.Fragment>
                                            )
                                        })}
                                        {/* Weekly Average Productivity */}
                                        <td className="p-2 text-center font-black text-purple-700 border-l border-purple-200">
                                            {/* Calc Weekly Total Revenue / Total Hours */}
                                            {(() => {
                                                let totalHours = 0;
                                                let totalRevenue = 0;
                                                days.forEach(d => {
                                                    // Revenue
                                                    const b = budgets.find((x: any) => x.data === d) || {};
                                                    totalRevenue += (b.valueLunch || 0) + (b.valueDinner || 0);

                                                    // Hours
                                                    staff.forEach(s => {
                                                        const sl = getShift(s.id, d, 'PRANZO');
                                                        const sdn = getShift(s.id, d, 'SERA');
                                                        if (sl?.start_time && sl?.end_time) totalHours += calcHours(sl.start_time, sl.end_time);
                                                        if (sdn?.start_time && sdn?.end_time) totalHours += calcHours(sdn.start_time, sdn.end_time);
                                                    });
                                                });
                                                const prod = totalHours > 0 ? totalRevenue / totalHours : 0;
                                                return prod > 0 ? `€${prod.toFixed(0)}` : '-';
                                            })()}
                                        </td>
                                        <td colSpan={2} className="bg-purple-50 border-t border-purple-100"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>

                        {/* ── Turni Non Coperti panel ───────────────────── */}
                        {missingShifts.length > 0 && (
                            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={18} className="text-amber-500" />
                                        <span className="font-bold text-amber-900 text-sm">
                                            {missingShifts.length} Turni Non Coperti
                                        </span>
                                        <span className="text-[11px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                                            Il sistema non ha trovato personale idoneo
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setMissingShifts([])}
                                        className="text-amber-400 hover:text-amber-700 text-xs px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors"
                                    >
                                        Chiudi ✕
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {missingShifts.map((m: any, i: number) => (
                                        <div key={i} className="bg-white border border-amber-100 rounded-xl px-3 py-2 flex flex-col gap-0.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-gray-800 text-xs">{m.station || '—'}</span>
                                                <span className="text-[10px] text-gray-400 font-mono">{m.date}</span>
                                            </div>
                                            <div className="text-[11px] text-indigo-600 font-semibold">{m.start} – {m.end}</div>
                                            {m.reason && (
                                                <div className="text-[10px] text-amber-700 truncate">{m.reason}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {contextMenu && (
                            <ContextMenu
                                x={contextMenu.x}
                                y={contextMenu.y}
                                onClose={() => setContextMenu(null)}
                                onAction={handleMenuAction}
                            />
                        )}

                        {editingCell && (
                            <ShiftEditorModal
                                isOpen={!!editingCell}
                                onClose={handleCloseEditor}
                                currentAssignment={editingCell.shift}
                                onSave={handleSaveShift}
                                staffName={staff.find(s => s.id === editingCell?.staffId)?.nome || ''}
                                date={editingCell?.date}
                                type={editingCell?.type}
                                templates={templates}
                            />
                        )}
                    </div>
                </div>

                {toast && (
                    <Toast
                        type={toast.type}
                        title={toast.title}
                        message={toast.message}
                        onClose={() => setToast(null)}
                    />
                )}

                <DragOverlay dropAnimation={null}>
                    {dragActiveId ? (
                        <div className="bg-white p-2 rounded shadow opacity-80 border-2 border-indigo-500 w-[120px] h-[40px] flex items-center justify-center font-bold text-xs truncate">
                            Spostando...
                        </div>
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
}
