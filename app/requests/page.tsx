'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { BadgeCheck, Ban, Clock, Plus, Search, Filter, MessageSquare, User, Trash2, CalendarCheck, CalendarX, Check, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Sunrise, Sunset } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import SearchableSelect from '@/components/SearchableSelect';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { isSameDay, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

interface Request {
    id: number;
    staffId: number;
    data: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    tipo: string;
    motivo: string;
    dettagli: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    adminResponse?: string;
    Staff?: {
        nome: string;
        cognome: string;
    };
    User?: { // Processor
        name: string;
        surname: string;
    }
}

export default function PermissionRequestsPage() {
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [staffList, setStaffList] = useState<any[]>([]); // To populate select if admin
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const calendarPopoverRef = useRef<HTMLDivElement>(null);
    const calendarButtonRef = useRef<HTMLButtonElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Admin-specific state
    const [adminEmployeeFilter, setAdminEmployeeFilter] = useState<number | null>(null); // filter pending by staffId
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [adminHistoryTab, setAdminHistoryTab] = useState<'approved' | 'rejected'>('approved');

    // New Request Form
    const [formData, setFormData] = useState({
        dates: [] as Date[], // For GIORNALIERO
        startDate: '', // For PERIODO
        endDate: '', // For PERIODO
        data: '', // For ORARIO (single date)
        startTime: '',
        endTime: '',
        mode: 'GIORNALIERO', // GIORNALIERO, PERIODO, ORARIO
        tipo: 'FERIE', // FERIE, PERMESSO, MALATTIA, DISPONIBILITA
        motivo: 'PERSONALE',
        dettagli: '',
        staffId: '' // For admin selection
    });

    const [isAvailability, setIsAvailability] = useState(false);
    const [isAllDay, setIsAllDay] = useState(true); // Default to all day

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (showCalendar && calendarPopoverRef.current) {
            setTimeout(() => {
                calendarPopoverRef.current?.focus();
            }, 10);
        }
    }, [showCalendar]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [reqs, prof, fetchedStaff] = await Promise.all([
                api.getPermissionRequests(),
                api.getProfile(),
                api.getStaff()
            ]);

            console.log("DEBUG: fetchedStaff", fetchedStaff);

            // Link profile to staff if possible
            const p = prof as any;
            const myStaff = (fetchedStaff as any[]).find(s => s.email === p.email);
            const userWithStaff = { ...p, staffId: myStaff?.id };

            setProfile(userWithStaff);
            setRequests(reqs as Request[]);
            setStaffList(fetchedStaff as any[]); // Store full list
        } catch (e: any) {
            console.error(e);
            alert("Errore caricamento: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const normalizedRole = profile?.role?.toUpperCase() || '';
    const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER' || normalizedRole === 'OWNER';

    // Filter logic — server already filters non-admin users to their own requests
    // For admin, all tenant requests are returned; for users, only their own
    const displayedRequests = requests.filter(r => {
        if (isAdmin) return true;
        return true; // Server already filtered to this user's requests
    });

    const pendingRequests = displayedRequests.filter(r => r.status === 'PENDING');
    const approvedRequests = displayedRequests.filter(r => r.status === 'APPROVED').sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const rejectedRequests = displayedRequests.filter(r => r.status === 'REJECTED').sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const historyRequests = displayedRequests.filter(r => r.status !== 'PENDING').sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    // Redesign State
    const [groupingMode, setGroupingMode] = useState<'week' | 'month'>('week');
    const [selectedDateFilter, setSelectedDateFilter] = useState<Date | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Toggle Group
    const toggleGroup = (groupId: string) => {
        const newSet = new Set(expandedGroups);
        if (newSet.has(groupId)) newSet.delete(groupId);
        else newSet.add(groupId);
        setExpandedGroups(newSet);
    };

    // Grouping Logic
    const getGroupKey = (date: Date, mode: 'week' | 'month') => {
        if (mode === 'month') return format(date, 'yyyy-MM');
        return format(date, 'yyyy-ww');
    };

    const getGroupLabel = (date: Date, mode: 'week' | 'month') => {
        if (mode === 'month') return format(date, 'MMMM yyyy', { locale: it });
        const day = date.getDay();
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        const monday = new Date(date);
        monday.setDate(date.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const weekNum = format(date, 'ww', { locale: it });
        const monStr = format(monday, 'd MMM', { locale: it });
        const sunStr = format(sunday, 'd MMM yyyy', { locale: it });
        return `Settimana ${weekNum}  ·  ${monStr} – ${sunStr}`;
    };

    const buildGroups = (list: Request[]) => {
        const groups: Record<string, { label: string, items: Request[], date: Date }> = {};
        let filtered = list;
        if (selectedDateFilter) {
            filtered = list.filter(r => isSameDay(new Date(r.data), selectedDateFilter));
        }
        filtered.forEach(req => {
            const d = new Date(req.data);
            const key = getGroupKey(d, groupingMode);
            if (!groups[key]) {
                groups[key] = { label: getGroupLabel(d, groupingMode), items: [], date: d };
            }
            groups[key].items.push(req);
        });
        return Object.entries(groups).sort((a, b) => b[1].date.getTime() - a[1].date.getTime());
    };

    const groupedApproved = React.useMemo(() => buildGroups(approvedRequests), [approvedRequests, groupingMode, selectedDateFilter]);
    const groupedRejected = React.useMemo(() => buildGroups(rejectedRequests), [rejectedRequests, groupingMode, selectedDateFilter]);
    const groupedRequests = React.useMemo(() => buildGroups(historyRequests), [historyRequests, groupingMode, selectedDateFilter]);

    // Initial Expand All
    useEffect(() => {
        if (historyRequests.length > 0 && expandedGroups.size === 0) {
            const approvedKeys = groupedApproved.map(g => 'a-' + g[0]);
            const rejectedKeys = groupedRejected.map(g => 'r-' + g[0]);
            setExpandedGroups(new Set([...approvedKeys, ...rejectedKeys]));
        }
    }, [groupedApproved.length, groupedRejected.length]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Check: if not admin, must have staffId. If admin, must have selected staffId OR have own staffId.
        const targetStaffId = (isAdmin && formData.staffId) ? parseInt(formData.staffId) : profile?.staffId;
        if (!targetStaffId) return alert("Errore: Nessun dipendente selezionato o Profilo Staff non trovato.");

        let requestData: any = {
            mode: formData.mode,
            tipo: formData.tipo,
            motivo: formData.motivo,
            dettagli: formData.dettagli,
            staffId: targetStaffId
        };

        if (formData.mode === 'GIORNALIERO') {
            if (formData.dates.length === 0) return alert("Selezionare almeno una data.");
            requestData.dates = formData.dates.map(d => d.toISOString().slice(0, 10));
            // Add optional times if present
            if (formData.startTime) requestData.startTime = formData.startTime;
            if (formData.endTime) requestData.endTime = formData.endTime;
        } else if (formData.mode === 'PERIODO') {
            if (!formData.startDate || !formData.endDate) return alert("Selezionare un periodo valido.");
            requestData.startDate = formData.startDate; // Keep these for reference if needed
            requestData.endDate = formData.endDate;

            // Generate dates array
            const start = new Date(formData.startDate);
            const end = new Date(formData.endDate);
            if (start > end) return alert("La data di inizio deve essere precedente alla data di fine.");

            const datesInRange = eachDayOfInterval({ start, end });
            requestData.dates = datesInRange.map(d => d.toISOString().slice(0, 10));
        }

        try {
            setIsSubmitting(true);
            await api.createPermissionRequest(requestData);
            setShowNewModal(false);
            setFormData({ ...formData, dettagli: '', dates: [], startDate: '', endDate: '', data: '', startTime: '', endTime: '' });
            loadData();
        } catch (e: any) {
            alert("Errore creazione: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAction = async (id: number, action: 'approve' | 'reject') => {
        let response = '';
        if (action === 'reject') {
            const input = prompt("Motivo rifiuto (opzionale):", "");
            if (input === null) return; // user cancelled
            response = input;
        }

        try {
            if (action === 'approve') await api.approveRequest(String(id), response);
            else await api.rejectRequest(String(id), response);
            loadData();
        } catch (e: any) {
            alert("Errore azione: " + e.message);
        }
    };

    const handleDayClick = (day: Date, modifiers: any, e: React.MouseEvent) => {
        const { ctrlKey, metaKey, shiftKey } = e;
        const currentSelection = formData.dates || [];
        let newSelection = [...currentSelection];

        if (shiftKey && currentSelection.length > 0) {
            const lastDate = currentSelection[currentSelection.length - 1];
            const start = lastDate < day ? lastDate : day;
            const end = lastDate < day ? day : lastDate;
            const daysInRange = [];
            let curr = start;
            while (curr <= end) {
                if (!currentSelection.some(d => isSameDay(d, curr))) {
                    daysInRange.push(curr);
                }
                curr = new Date(curr.setDate(curr.getDate() + 1));
            }
            newSelection = [...currentSelection, ...daysInRange];
        } else if (ctrlKey || metaKey) {
            if (currentSelection.some(d => isSameDay(d, day))) {
                newSelection = currentSelection.filter(d => !isSameDay(d, day));
            } else {
                newSelection.push(day);
            }
        } else {
            if (currentSelection.some(d => isSameDay(d, day))) {
                newSelection = currentSelection.filter(d => !isSameDay(d, day));
            } else {
                newSelection.push(day);
            }
        }

        setFormData({ ...formData, dates: newSelection });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            {isAdmin ? (
                /* ── ADMIN DASHBOARD HEADER ── */
                <div className="space-y-4">
                    <div className="flex justify-between items-start bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
                        <div>
                            <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1">Pannello Admin</p>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Richieste Permessi</h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Gestisci ferie, permessi e disponibilità di tutti i dipendenti</p>
                        </div>
                        <button
                            onClick={() => setShowNewModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all active:scale-95 font-medium"
                        >
                            <Plus size={20} /> Nuova Richiesta
                        </button>
                    </div>
                    {/* Admin Stats Row */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-orange-100 dark:border-orange-900/30 p-5 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                                <Clock size={22} className="text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-orange-600 dark:text-orange-400">{pendingRequests.length}</p>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">In Attesa</p>
                                {pendingRequests.length > 0 && (
                                    <p className="text-[10px] text-orange-400 mt-0.5">
                                        {new Set(pendingRequests.map(r => r.staffId)).size} dipendenti
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-green-100 dark:border-green-900/30 p-5 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                <Check size={22} className="text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-green-600 dark:text-green-400">{approvedRequests.length}</p>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Approvate</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-100 dark:border-red-900/30 p-5 flex items-center gap-4 shadow-sm">
                            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <X size={22} className="text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-red-600 dark:text-red-400">{rejectedRequests.length}</p>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rifiutate</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── USER PERSONAL HEADER ── */
                <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
                    <div>
                        <p className="text-sm font-medium text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1">Le tue richieste</p>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {profile?.staffName || `${profile?.name || ''} ${profile?.surname || ''}`.trim() || 'Benvenuto'}
                        </h1>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                                <Clock size={11} /> {pendingRequests.length} in attesa
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                <Check size={11} /> {approvedRequests.length} approvate
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                <X size={11} /> {rejectedRequests.length} rifiutate
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all active:scale-95 font-medium"
                    >
                        <Plus size={20} /> Nuova Richiesta
                    </button>
                </div>
            )}

            {/* Content ... */}

            {/* Pending Section */}
            {(pendingRequests.length > 0 || isAdmin) && (
                <div className="mb-2">
                    {/* Admin toolbar */}
                    {isAdmin && (
                        <div className="flex flex-wrap gap-3 items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 mr-auto">
                                <Clock size={20} className="text-orange-500" />
                                In Attesa
                                <span className="ml-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm font-black">
                                    {pendingRequests.filter(r =>
                                        (adminEmployeeFilter === null || r.staffId === adminEmployeeFilter) &&
                                        (adminSearchQuery === '' || `${r.Staff?.nome} ${r.Staff?.cognome}`.toLowerCase().includes(adminSearchQuery.toLowerCase()) || (r.dettagli || r.motivo || '').toLowerCase().includes(adminSearchQuery.toLowerCase()))
                                    ).length}
                                </span>
                            </h2>
                            {/* Employee filter */}
                            {staffList.length > 0 && (
                                <select
                                    value={adminEmployeeFilter ?? ''}
                                    onChange={e => setAdminEmployeeFilter(e.target.value ? Number(e.target.value) : null)}
                                    className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                >
                                    <option value="">Tutti i dipendenti</option>
                                    {staffList.filter(s => pendingRequests.some(r => r.staffId === s.id)).map(s => (
                                        <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>
                                    ))}
                                </select>
                            )}
                            {/* Search */}
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca..."
                                    value={adminSearchQuery}
                                    onChange={e => setAdminSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
                                />
                            </div>
                            {/* Bulk approve all visible */}
                            {pendingRequests.length > 0 && (
                                <button
                                    onClick={async () => {
                                        const toApprove = pendingRequests.filter(r =>
                                            (adminEmployeeFilter === null || r.staffId === adminEmployeeFilter) &&
                                            (adminSearchQuery === '' || `${r.Staff?.nome} ${r.Staff?.cognome}`.toLowerCase().includes(adminSearchQuery.toLowerCase()))
                                        );
                                        if (!confirm(`Approvare tutte le ${toApprove.length} richieste visibili?`)) return;
                                        for (const r of toApprove) {
                                            await api.approveRequest(String(r.id), '');
                                        }
                                        loadData();
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition active:scale-95 shadow-sm"
                                >
                                    <Check size={15} /> Approva tutte
                                </button>
                            )}
                        </div>
                    )}

                    {/* Non-admin section title */}
                    {!isAdmin && pendingRequests.length > 0 && (
                        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <Clock size={20} className="text-orange-500" />
                            In Attesa ({pendingRequests.length})
                        </h2>
                    )}

                    {pendingRequests.length === 0 && isAdmin ? (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-200 dark:border-slate-600 p-8 text-center text-gray-400 dark:text-gray-500">
                            <Check size={32} className="mx-auto mb-2 text-green-400" />
                            <p className="font-semibold">Nessuna richiesta in attesa</p>
                            <p className="text-sm mt-1">Tutto approvato o nessuna richiesta ricevuta</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingRequests
                                .filter(req =>
                                    (adminEmployeeFilter === null || req.staffId === adminEmployeeFilter) &&
                                    (adminSearchQuery === '' || `${req.Staff?.nome} ${req.Staff?.cognome}`.toLowerCase().includes(adminSearchQuery.toLowerCase()) || (req.dettagli || req.motivo || '').toLowerCase().includes(adminSearchQuery.toLowerCase()))
                                )
                                .map(req => (
                                    <div key={req.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-l-4 border-l-orange-400 border-gray-100 dark:border-slate-700 flex flex-col justify-between overflow-hidden">
                                        {/* Card top: date + info */}
                                        <div className="flex items-stretch">
                                            <div className="flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-4 py-4 min-w-[64px]">
                                                <span className="text-3xl font-black leading-none">{new Date(req.data).getDate()}</span>
                                                <span className="text-[10px] uppercase font-bold mt-0.5">{new Date(req.data).toLocaleString('it', { month: 'short' })}</span>
                                                <span className="text-[10px] text-orange-400 font-medium">{new Date(req.data).getFullYear()}</span>
                                            </div>
                                            <div className="flex-1 p-4">
                                                {isAdmin && (
                                                    <div className="font-bold text-gray-800 dark:text-white mb-1 text-base">
                                                        {req.Staff ? `${req.Staff.nome} ${req.Staff.cognome}` : <span className="text-gray-400 italic">Dipendente sconosciuto</span>}
                                                    </div>
                                                )}
                                                <span className="text-xs font-bold px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded uppercase">{req.tipo}</span>
                                                {req.endDate && req.endDate !== req.data && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">fino al {new Date(req.endDate).toLocaleDateString('it')}</p>
                                                )}
                                                {(req.startTime && req.endTime) && (
                                                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">🕐 {req.startTime} – {req.endTime}</p>
                                                )}
                                                {(req.dettagli || req.motivo) && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{req.dettagli || req.motivo}</p>
                                                )}
                                            </div>
                                            {/* Admin: delete button top-right */}
                                            {isAdmin && (
                                                <button
                                                    onClick={() => { if (confirm('Eliminare questa richiesta?')) api.deletePermissionRequest(req.id).then(loadData).catch(err => alert(err.message)); }}
                                                    className="p-2 m-2 text-gray-300 hover:text-red-500 transition self-start"
                                                    title="Elimina"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                        {/* Admin actions */}
                                        {isAdmin && (
                                            <div className="flex gap-0 border-t border-gray-100 dark:border-slate-700">
                                                <button onClick={() => handleAction(req.id, 'approve')} className="flex-1 py-2.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 font-semibold transition text-sm border-r border-gray-100 dark:border-slate-700 flex items-center justify-center gap-1.5">
                                                    <Check size={14} /> Approva
                                                </button>
                                                <button onClick={() => handleAction(req.id, 'reject')} className="flex-1 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold transition text-sm flex items-center justify-center gap-1.5">
                                                    <X size={14} /> Rifiuta
                                                </button>
                                            </div>
                                        )}
                                        {/* User: pending badge */}
                                        {!isAdmin && (
                                            <div className="px-4 py-2.5 bg-orange-50 dark:bg-orange-900/10 border-t border-orange-100 dark:border-orange-900/20 flex items-center gap-1.5">
                                                <Clock size={12} className="text-orange-400" />
                                                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">In attesa di approvazione</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            )}


            {/* Complete Section - Redesigned */}
            <div className="space-y-6">

                {/* Timeline Filter and Controls */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center transition-colors">
                    <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg transition-colors">
                        <button
                            onClick={() => setGroupingMode('week')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${groupingMode === 'week' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            Settimana
                        </button>
                        <button
                            onClick={() => setGroupingMode('month')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${groupingMode === 'month' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        >
                            Mese
                        </button>
                    </div>

                    <div className="flex-1 w-full overflow-x-auto flex gap-2 pb-2 md:pb-0 scrollbar-hide items-center">
                        {/* Functional Timeline */}
                        {selectedDateFilter && (
                            <button
                                onClick={() => setSelectedDateFilter(null)}
                                className="px-3 py-1.5 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1 transition shrink-0"
                            >
                                <X size={14} /> Reset
                            </button>
                        )}

                        {/* Generate last 7 days and next 14 days for quick access */}
                        {Array.from({ length: 21 }).map((_, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - 7 + i);
                            const isSelected = selectedDateFilter && isSameDay(d, selectedDateFilter);
                            const isToday = isSameDay(d, new Date());

                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDateFilter(isSelected ? null : d)}
                                    className={`
                                       flex flex-col items-center justify-center min-w-[3.5rem] py-2 rounded-lg border transition shrink-0
                                       ${isSelected
                                            ? 'bg-blue-600 text-white border-blue-700 shadow-md transform scale-105'
                                            : isToday
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                                : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                                        }
                                   `}
                                >
                                    <span className="text-[10px] uppercase font-bold opacity-80">{format(d, 'EEE', { locale: it })}</span>
                                    <span className={`text-lg font-bold leading-none ${isSelected ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>{format(d, 'dd')}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Approvate Section */}
                <div className="space-y-4">
                    <h2 className="text-base font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                        <Check size={18} className="text-green-500" />
                        Approvate ({approvedRequests.length})
                    </h2>
                    {approvedRequests.length === 0 ? (
                        <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-500 transition-colors text-sm">
                            Nessuna richiesta approvata.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedApproved.map(([key, group]) => (
                                <div key={key} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-green-100 dark:border-green-900/30 overflow-hidden transition-colors">
                                    <div onClick={() => toggleGroup('a-' + key)} className="bg-green-50 dark:bg-green-900/10 p-3 px-4 flex justify-between items-center cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-900/20 transition border-b border-green-100 dark:border-green-900/30">
                                        <h3 className="font-bold text-green-800 dark:text-green-300 text-sm uppercase tracking-wide">{group.label}</h3>
                                        <div className="text-green-400">{expandedGroups.has('a-' + key) ? <ChevronRight size={16} className="rotate-90 transition-transform" /> : <ChevronRight size={16} className="transition-transform" />}</div>
                                    </div>
                                    {expandedGroups.has('a-' + key) && (
                                        <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                                            {group.items.map((req, index) => {
                                                const dateObj = new Date(req.data);
                                                const prevReq = index > 0 ? group.items[index - 1] : null;
                                                const isSameUser = prevReq && prevReq.staffId === req.staffId;
                                                return (
                                                    <div key={req.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition flex gap-4 items-start">
                                                        <div className="flex-shrink-0 flex flex-col items-center bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg p-2 w-16 h-16 justify-center border border-green-100 dark:border-green-900/30">
                                                            <span className="text-2xl font-bold leading-none">{format(dateObj, 'dd')}</span>
                                                            <span className="text-[10px] uppercase font-semibold">{format(dateObj, 'MMM', { locale: it })}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    {(isAdmin && (!isSameUser || !req.Staff)) && (
                                                                        <div className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
                                                                            {req.Staff ? `${req.Staff.nome} ${req.Staff.cognome}` : <span className="text-gray-400 italic text-sm">Dipendente sconosciuto</span>}
                                                                        </div>
                                                                    )}
                                                                    <div className={`flex items-center gap-2 ${!isSameUser ? 'mt-1' : ''}`}>
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${req.tipo === 'DISPONIBILITA' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>{req.tipo}</span>
                                                                        {req.adminResponse && (<span className="text-xs text-gray-400 flex items-center gap-1"><MessageSquare size={12} /> {req.adminResponse}</span>)}
                                                                    </div>
                                                                </div>
                                                                <Check size={20} className="text-green-500 flex-shrink-0" />
                                                            </div>
                                                            {(req.startTime && req.endTime) && (<p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">🕐 {req.startTime} – {req.endTime}</p>)}
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{req.dettagli || req.motivo}</p>
                                                        </div>
                                                        {isAdmin && (
                                                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Eliminare questa richiesta?')) { api.deletePermissionRequest(req.id).then(loadData).catch(err => alert(err.message)); } }} className="text-gray-300 hover:text-red-500 p-2" title="Elimina"><Trash2 size={16} /></button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Rifiutate Section */}
                <div className="space-y-4">
                    <h2 className="text-base font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                        <X size={18} className="text-red-500" />
                        Rifiutate ({rejectedRequests.length})
                    </h2>
                    {rejectedRequests.length === 0 ? (
                        <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-500 transition-colors text-sm">
                            Nessuna richiesta rifiutata.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedRejected.map(([key, group]) => (
                                <div key={key} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30 overflow-hidden transition-colors">
                                    <div onClick={() => toggleGroup('r-' + key)} className="bg-red-50 dark:bg-red-900/10 p-3 px-4 flex justify-between items-center cursor-pointer hover:bg-red-100/50 dark:hover:bg-red-900/20 transition border-b border-red-100 dark:border-red-900/30">
                                        <h3 className="font-bold text-red-800 dark:text-red-300 text-sm uppercase tracking-wide">{group.label}</h3>
                                        <div className="text-red-400">{expandedGroups.has('r-' + key) ? <ChevronRight size={16} className="rotate-90 transition-transform" /> : <ChevronRight size={16} className="transition-transform" />}</div>
                                    </div>
                                    {expandedGroups.has('r-' + key) && (
                                        <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                                            {group.items.map((req, index) => {
                                                const dateObj = new Date(req.data);
                                                const prevReq = index > 0 ? group.items[index - 1] : null;
                                                const isSameUser = prevReq && prevReq.staffId === req.staffId;
                                                return (
                                                    <div key={req.id} className="p-4 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition flex gap-4 items-start">
                                                        <div className="flex-shrink-0 flex flex-col items-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg p-2 w-16 h-16 justify-center border border-red-100 dark:border-red-900/30">
                                                            <span className="text-2xl font-bold leading-none">{format(dateObj, 'dd')}</span>
                                                            <span className="text-[10px] uppercase font-semibold">{format(dateObj, 'MMM', { locale: it })}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    {(isAdmin && (!isSameUser || !req.Staff)) && (
                                                                        <div className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
                                                                            {req.Staff ? `${req.Staff.nome} ${req.Staff.cognome}` : <span className="text-gray-400 italic text-sm">Dipendente sconosciuto</span>}
                                                                        </div>
                                                                    )}
                                                                    <div className={`flex items-center gap-2 ${!isSameUser ? 'mt-1' : ''}`}>
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${req.tipo === 'DISPONIBILITA' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>{req.tipo}</span>
                                                                        {req.adminResponse && (<span className="text-xs text-red-400 flex items-center gap-1"><MessageSquare size={12} /> {req.adminResponse}</span>)}
                                                                    </div>
                                                                </div>
                                                                <X size={20} className="text-red-400 flex-shrink-0" />
                                                            </div>
                                                            {(req.startTime && req.endTime) && (<p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">🕐 {req.startTime} – {req.endTime}</p>)}
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{req.dettagli || req.motivo}</p>
                                                        </div>
                                                        {isAdmin && (
                                                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Eliminare questa richiesta?')) { api.deletePermissionRequest(req.id).then(loadData).catch(err => alert(err.message)); } }} className="text-gray-300 hover:text-red-500 p-2" title="Elimina"><Trash2 size={16} /></button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>


            {/* Modal */}
            {
                showNewModal && (
                    <div
                        className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 backdrop-blur-sm"
                        onClick={() => setShowNewModal(false)}
                    >
                        <div
                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden outline-none transition-colors"
                            onClick={(e) => e.stopPropagation()}
                            tabIndex={-1}
                        >

                            {/* Modal Header */}
                            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-slate-700">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nuova Richiesta</h3>
                                <button type="button" onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto max-h-[70vh]">
                                <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg mb-6 transition-colors">
                                    <button
                                        type="button"
                                        onClick={() => { setIsAvailability(false); setFormData({ ...formData, tipo: 'FERIE' }); }}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 border ${!isAvailability ? 'bg-white dark:bg-slate-600 text-blue-700 dark:text-blue-300 shadow-sm border-blue-100 dark:border-blue-500/30' : 'bg-transparent text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200/50 dark:hover:bg-slate-600/50'}`}
                                    >
                                        <CalendarX size={16} className="inline mr-2 mb-0.5" /> Assenza
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setIsAvailability(true); setFormData({ ...formData, tipo: 'DISPONIBILITA', motivo: 'EXTRA' }); }}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 border ${isAvailability ? 'bg-white dark:bg-slate-600 text-green-700 dark:text-green-400 shadow-sm border-green-100 dark:border-green-500/30' : 'bg-transparent text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200/50 dark:hover:bg-slate-600/50'}`}
                                    >
                                        <CalendarCheck size={16} className="inline mr-2 mb-0.5" /> Disponibilità
                                    </button>
                                </div>

                                <form id="requestForm" onSubmit={handleSubmit} className="space-y-6">
                                    {isAdmin && (
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Dipendente (Admin)</label>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    Role: {profile?.role} | Staff: {staffList.length} | ID: {profile?.id}
                                                </span>
                                            </div>
                                            {/* DEBUG: Visual check if list is empty but length is somehow wrong or rendering issue */}
                                            {staffList.length === 0 && (
                                                <div className="text-xs text-red-500 mb-2">
                                                    ⚠️ Warning: Staff list is empty. ({JSON.stringify(staffList).slice(0, 50)})
                                                </div>
                                            )}
                                            <SearchableSelect
                                                className="mb-4"
                                                placeholder="-- Cerca Dipendente --"
                                                options={staffList.map((s: any) => ({
                                                    value: s.id,
                                                    label: `${s.nome} ${s.cognome}`
                                                }))}
                                                value={formData.staffId}
                                                onChange={(val: string | number) => setFormData({ ...formData, staffId: String(val) })}
                                            />
                                        </div>
                                    )}

                                    {/* Side-by-side Fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {!isAvailability ? (
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Tipo Assenza</label>
                                                <select
                                                    className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-400 dark:focus:border-blue-500 outline-none transition-all text-sm"
                                                    value={formData.tipo}
                                                    onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                                    tabIndex={0}
                                                >
                                                    <option value="FERIE">Ferie</option>
                                                    <option value="PERMESSO">Permesso</option>
                                                    <option value="MALATTIA">Malattia</option>
                                                    <option value="ALTRO">Altro</option>
                                                </select>
                                            </div>
                                        ) : null}

                                        <div className={isAvailability ? "col-span-2" : ""}>
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Motivazione</label>
                                            <select
                                                className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-400 dark:focus:border-blue-500 outline-none transition-all text-sm"
                                                value={formData.motivo}
                                                onChange={e => setFormData({ ...formData, motivo: e.target.value })}
                                                tabIndex={0}
                                            >
                                                {!isAvailability ? (
                                                    <>
                                                        <option value="PERSONALE">Personale</option>
                                                        <option value="SALUTE">Salute</option>
                                                        <option value="FAMIGLIA">Famiglia</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="EXTRA">Straordinario / Extra</option>
                                                        <option value="RECUPERO">Recupero</option>
                                                        <option value="CAMBIO_TURNO">Cambio Turno</option>
                                                        <option value="PERSONALE">Personale</option>
                                                        <option value="FAMIGLIA">Famiglia</option>
                                                        <option value="STUDIO">Studio</option>
                                                        <option value="EMERGENZA">Emergenza</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                            {formData.mode === 'GIORNALIERO' ? 'Date e Orari' : 'Periodo Continuativo'}
                                        </label>
                                        <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-lg mb-4 transition-colors">
                                            {['GIORNALIERO', 'PERIODO'].map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, mode: m })}
                                                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${formData.mode === m
                                                        ? (isAvailability ? 'bg-white dark:bg-slate-600 text-green-700 dark:text-green-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'bg-white dark:bg-slate-600 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10')
                                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-slate-600/50'
                                                        }`}
                                                    tabIndex={0}
                                                >
                                                    {m === 'GIORNALIERO' ? 'Date Selezionate' : 'Periodo (Più Giorni)'}
                                                </button>
                                            ))}
                                        </div>

                                        {formData.mode === 'GIORNALIERO' && (
                                            <div className="space-y-4">
                                                <div className="relative">
                                                    <button
                                                        ref={calendarButtonRef}
                                                        type="button"
                                                        onClick={() => setShowCalendar(!showCalendar)}
                                                        className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-left text-sm flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 active:bg-gray-50 dark:active:bg-slate-600 transition-all"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setShowCalendar(!showCalendar);
                                                            }
                                                        }}
                                                    >
                                                        <span className={formData.dates.length === 0 ? "text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-white font-medium"}>
                                                            {formData.dates.length > 0
                                                                ? `${formData.dates.length} date selezionate`
                                                                : "Seleziona date..."}
                                                        </span>
                                                        <CalendarIcon size={16} className="text-gray-400" />
                                                    </button>

                                                    {showCalendar && (
                                                        <div
                                                            ref={calendarPopoverRef}
                                                            tabIndex={-1}
                                                            className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-20 w-[320px] animate-in fade-in zoom-in-95 duration-200 outline-none"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') {
                                                                    setShowCalendar(false);
                                                                    calendarButtonRef.current?.focus();
                                                                }
                                                                if (e.key === 'Enter') {
                                                                    // Allow selection to happen first (DayPicker handles Enter/Space), then close
                                                                    // We use setTimeout to let the event bubble/process in DayPicker
                                                                    setTimeout(() => {
                                                                        setShowCalendar(false);
                                                                        calendarButtonRef.current?.focus();
                                                                    }, 0);
                                                                }
                                                            }}
                                                        >
                                                            <style>{`
                                                            .rdp { --rdp-cell-size: 36px; --rdp-accent-color: ${isAvailability ? '#15803d' : '#2563eb'}; margin: 0; }
                                                            .rdp-day_selected:not([disabled]) { background-color: var(--rdp-accent-color); color: white; }
                                                            .rdp-day:hover:not(.rdp-day_selected) { background-color: #f3f4f6; }
                                                            .dark .rdp-day:hover:not(.rdp-day_selected) { background-color: #334155; }
                                                            .dark .rdp-day { color: #e2e8f0; }
                                                            .dark .rdp-caption_label { color: #f8fafc; }
                                                            .dark .rdp-button:hover:not([disabled]) { color: #f8fafc; background-color: #334155; }
                                                            .dark .rdp-head_cell { color: #94a3b8; }
                                                            .dark .rdp-nav_button { color: #cbd5e1; }
                                                        `}</style>
                                                            <DayPicker
                                                                mode="multiple"
                                                                selected={formData.dates}
                                                                onDayClick={handleDayClick}
                                                                locale={it}
                                                                modifiersClassNames={{ selected: 'selected-day' }}
                                                            />
                                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowCalendar(false)}
                                                                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                                                    tabIndex={0}
                                                                >
                                                                    Fatto
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {formData.dates.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {formData.dates.slice(0, 5).map((d, i) => (
                                                                <span key={i} className="text-xs bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md border border-gray-200 dark:border-slate-600">
                                                                    {format(d, 'd MMM', { locale: it })}
                                                                </span>
                                                            ))}
                                                            {formData.dates.length > 5 && (
                                                                <span className="text-xs bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-md border border-gray-200 dark:border-slate-600">+{formData.dates.length - 5}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-2 border-t border-gray-50 dark:border-slate-700/50 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            id="allDay"
                                                            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:bg-slate-700"
                                                            checked={isAllDay}
                                                            onChange={(e) => {
                                                                setIsAllDay(e.target.checked);
                                                                if (e.target.checked) {
                                                                    setFormData({ ...formData, startTime: '', endTime: '' });
                                                                }
                                                            }}
                                                        />
                                                        <label htmlFor="allDay" className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none cursor-pointer">
                                                            Tutto il giorno
                                                        </label>
                                                    </div>

                                                    {!isAllDay && (
                                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            {/* Presets */}
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData({ ...formData, startTime: '08:30', endTime: '18:00' })}
                                                                    className="flex-1 py-1.5 px-2 text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-900/30 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition flex items-center justify-center gap-1"
                                                                >
                                                                    <Sunrise size={14} /> Pranzo
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData({ ...formData, startTime: '18:00', endTime: '02:00' })}
                                                                    className="flex-1 py-1.5 px-2 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition flex items-center justify-center gap-1"
                                                                >
                                                                    <Sunset size={14} /> Sera
                                                                </button>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Dalle</label>
                                                                    <input
                                                                        type="time"
                                                                        className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none"
                                                                        value={formData.startTime || ''}
                                                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                                                        tabIndex={0}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Alle</label>
                                                                    <input
                                                                        type="time"
                                                                        className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none"
                                                                        value={formData.endTime || ''}
                                                                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                                                        tabIndex={0}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {formData.mode === 'PERIODO' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Dal</label>
                                                        <input
                                                            type="date"
                                                            className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none"
                                                            value={formData.startDate || ''}
                                                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                                            tabIndex={0}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Al</label>
                                                        <input
                                                            type="date"
                                                            className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none"
                                                            value={formData.endDate || ''}
                                                            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                                            tabIndex={0}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Time range for PERIODO */}
                                                <div className="pt-2 border-t border-gray-50 dark:border-slate-700/50 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            id="allDayPeriodo"
                                                            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500 dark:bg-slate-700"
                                                            checked={isAllDay}
                                                            onChange={(e) => {
                                                                setIsAllDay(e.target.checked);
                                                                if (e.target.checked) {
                                                                    setFormData({ ...formData, startTime: '', endTime: '' });
                                                                }
                                                            }}
                                                        />
                                                        <label htmlFor="allDayPeriodo" className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none cursor-pointer">
                                                            Tutto il giorno
                                                        </label>
                                                    </div>

                                                    {!isAllDay && (
                                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData({ ...formData, startTime: '08:30', endTime: '18:00' })}
                                                                    className="flex-1 py-1.5 px-2 text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-900/30 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition flex items-center justify-center gap-1"
                                                                >
                                                                    <Sunrise size={14} /> Pranzo
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData({ ...formData, startTime: '18:00', endTime: '02:00' })}
                                                                    className="flex-1 py-1.5 px-2 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/30 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition flex items-center justify-center gap-1"
                                                                >
                                                                    <Sunset size={14} /> Sera
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Dalle</label>
                                                                    <input
                                                                        type="time"
                                                                        className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none"
                                                                        value={formData.startTime || ''}
                                                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                                                        tabIndex={0}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">Alle</label>
                                                                    <input
                                                                        type="time"
                                                                        className="w-full p-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 outline-none"
                                                                        value={formData.endTime || ''}
                                                                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                                                        tabIndex={0}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Note / Dettagli</label>
                                        <textarea
                                            className="w-full p-3 border border-gray-200 dark:border-slate-600 rounded-lg h-20 resize-none text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-400 dark:focus:border-blue-500 outline-none transition-all"
                                            placeholder="Note opzionali..."
                                            value={formData.dettagli}
                                            onChange={e => setFormData({ ...formData, dettagli: e.target.value })}
                                        ></textarea>
                                    </div>

                                </form>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/30 flex gap-3 transition-colors">
                                <button type="button" onClick={() => setShowNewModal(false)} disabled={isSubmitting} className="flex-1 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 hover:text-gray-800 dark:hover:text-white rounded-lg text-gray-600 dark:text-gray-200 font-bold transition shadow-sm text-sm disabled:opacity-50">Annulla</button>
                                <button type="submit" form="requestForm" disabled={isSubmitting} className={`flex-1 py-2.5 rounded-lg text-white font-bold transition shadow-sm text-sm ${isAvailability ? 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    {isSubmitting ? 'Invio in corso...' : 'Invia Richiesta'}
                                </button>
                            </div>
                        </div>
                    </div >
                )
            }
        </div >
    );
}
