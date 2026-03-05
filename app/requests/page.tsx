
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { BadgeCheck, Ban, Clock, Plus, Search, Filter, MessageSquare, User, Trash2, Check, X, ChevronRight, Calendar, LayoutGrid } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';


interface Request {
    id: number;
    staffId: number;
    data: string;
    tipo: string;
    motivo: string;
    dettagli: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
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
    const [staffList, setStaffList] = useState<any[]>([]); // To populate select if admin
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const calendarPopoverRef = useRef<HTMLDivElement>(null);
    const calendarButtonRef = useRef<HTMLButtonElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Admin-specific state
    const [adminEmployeeFilter, setAdminEmployeeFilter] = useState<number | null>(null); // filter pending by staffId
    const [adminSearchQuery, setAdminSearchQuery] = useState('');
    const [adminHistoryTab, setAdminHistoryTab] = useState<'approved' | 'rejected'>('approved');


    // New Request Form
    const [formData, setFormData] = useState({
        data: new Date().toISOString().slice(0, 10),
        endDate: '',
        startTime: '',
        endTime: '',
        mode: 'GIORNALIERO', // GIORNALIERO, PERIODO, ORARIO
        tipo: 'FERIE', // FERIE, PERMESSO, MALATTIA
        motivo: 'PERSONALE',
        dettagli: '',
        staffId: '' // For admin selection
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [reqs, prof, staffList] = await Promise.all([
                api.getPermissionRequests(),
                api.getProfile(),
                api.getStaff() // Needed to map current user to staffId if we want to filter strictly or auto-fill
            ]);

            // Link profile to staff if possible
            const p = prof as any;
            const myStaff = (staffList as any[]).find(s => s.email === p.email);
            const userWithStaff = { ...p, staffId: myStaff?.id };

            setProfile(userWithStaff);
            setRequests(reqs as Request[]);
            setStaffList(staffList as any[]); // Store full list
        } catch (e: any) {
            console.error(e);
            alert("Errore caricamento: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'MANAGER' || profile?.role === 'OWNER';

    // Filter logic
    const displayedRequests = requests.filter(r => {
        if (isAdmin) return true; // Admins see all
        return r.staffId === profile?.staffId; // Users see own
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

    const formatDateHeader = (date: string) => {
        const d = new Date(date);
        return {
            day: format(d, 'd'),
            weekday: format(d, 'eee', { locale: it }).toUpperCase(),
            month: format(d, 'MMM', { locale: it }).toUpperCase(),
            year: d.getFullYear()
        };
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

        try {
            await api.createPermissionRequest({
                ...formData,
                staffId: targetStaffId
            });
            setShowNewModal(false);
            setFormData({ ...formData, dettagli: '' });
            loadData();
        } catch (e: any) {
            alert("Errore creazione: " + e.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Eliminare definitivamente ${selectedIds.size} richieste selezionate?`)) return;

        try {
            setLoading(true);
            await api.deleteMultiplePermissionRequests(Array.from(selectedIds));
            setSelectedIds(new Set());
            loadData();
        } catch (e: any) {
            alert("Errore eliminazione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = (items: Request[]) => {
        const itemIds = items.map(r => r.id);
        const allSelected = itemIds.every(id => selectedIds.has(id));

        const newSet = new Set(selectedIds);
        if (allSelected) {
            itemIds.forEach(id => newSet.delete(id));
        } else {
            itemIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const handleAction = async (id: number, action: 'approve' | 'reject') => {
        const response = prompt(action === 'approve' ? "Nota approvazione (opzionale):" : "Motivo rifiuto (opzionale):", "");
        if (response === null) return;

        try {
            if (action === 'approve') await api.approveRequest(String(id), response);
            else await api.rejectRequest(String(id), response);
            loadData();
        } catch (e: any) {
            alert("Errore azione: " + e.message);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-8 duration-300">
                    <span className="text-sm font-bold">{selectedIds.size} selezionate</span>
                    <div className="h-6 w-px bg-slate-700" />
                    <div className="flex gap-2">
                        {isAdmin && (
                            <button
                                onClick={async () => {
                                    if (!confirm(`Approvare le ${selectedIds.size} richieste selezionate?`)) return;
                                    setLoading(true);
                                    for (const id of Array.from(selectedIds)) {
                                        await api.approveRequest(String(id), '');
                                    }
                                    setSelectedIds(new Set());
                                    loadData();
                                }}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                            >
                                <Check size={14} /> Approva
                            </button>
                        )}
                        <button
                            onClick={handleBulkDelete}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                        >
                            <Trash2 size={14} /> Elimina
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition"
                        >
                            Annulla
                        </button>
                    </div>
                </div>
            )}

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
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-orange-100 dark:border-orange-900/30 p-5 flex items-center gap-4 shadow-sm group hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <Clock size={22} className="text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-orange-600 dark:text-orange-400 leading-none">{pendingRequests.length}</p>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">In Attesa</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-green-100 dark:border-green-900/30 p-5 flex items-center gap-4 shadow-sm group hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <Check size={22} className="text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-green-600 dark:text-green-400 leading-none">{approvedRequests.length}</p>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">Approvate</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-100 dark:border-red-900/30 p-5 flex items-center gap-4 shadow-sm group hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <X size={22} className="text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-3xl font-black text-red-600 dark:text-red-400 leading-none">{rejectedRequests.length}</p>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">Rifiutate</p>
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
                            <div className="flex items-center gap-3 mr-auto">
                                <input
                                    type="checkbox"
                                    checked={pendingRequests.length > 0 && pendingRequests.every(r => selectedIds.has(r.id))}
                                    onChange={() => toggleSelectAll(pendingRequests)}
                                    className="w-4 h-4 text-orange-600 rounded cursor-pointer"
                                />
                                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                    <Clock size={20} className="text-orange-500" />
                                    In Attesa
                                    <span className="ml-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm font-black">
                                        {pendingRequests.filter(r =>
                                            (adminEmployeeFilter === null || r.staffId === adminEmployeeFilter) &&
                                            (adminSearchQuery === '' || `${r.Staff?.nome} ${r.Staff?.cognome}`.toLowerCase().includes(adminSearchQuery.toLowerCase()) || (r.dettagli || r.motivo || '').toLowerCase().includes(adminSearchQuery.toLowerCase()))
                                        ).length}
                                    </span>
                                </h2>
                            </div>
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
                        <div className="flex items-center gap-3 mb-4">
                            <input
                                type="checkbox"
                                checked={pendingRequests.every(r => selectedIds.has(r.id))}
                                onChange={() => toggleSelectAll(pendingRequests)}
                                className="w-4 h-4 text-orange-600 rounded cursor-pointer"
                            />
                            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <Clock size={20} className="text-orange-500" />
                                In Attesa ({pendingRequests.length})
                            </h2>
                        </div>
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
                                .map(req => {
                                    const dateInfo = formatDateHeader(req.data);
                                    const isSelected = selectedIds.has(req.id);
                                    return (
                                        <div
                                            key={req.id}
                                            onClick={() => toggleSelection(req.id)}
                                            className={`
                                                group relative bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 transition-all cursor-pointer overflow-hidden
                                                ${isSelected ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-transparent hover:border-gray-200 dark:hover:border-slate-700 shadow-sm'}
                                            `}
                                        >
                                            <div className="flex items-stretch">
                                                {/* Selection Overlay Checkbox */}
                                                <div className={`absolute top-3 left-3 w-5 h-5 rounded border-2 z-10 transition-colors flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-white/80 dark:bg-slate-800/80 border-gray-300 dark:border-slate-600'}`}>
                                                    {isSelected && <Check size={14} className="text-white" />}
                                                </div>

                                                <div className="flex flex-col items-center justify-center bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-4 py-4 min-w-[72px]">
                                                    <span className="text-[10px] uppercase font-bold text-orange-400 mb-1">{dateInfo.weekday}</span>
                                                    <span className="text-3xl font-black leading-none">{dateInfo.day}</span>
                                                    <span className="text-[10px] uppercase font-bold mt-1 text-orange-500">{dateInfo.month}</span>
                                                </div>
                                                <div className="flex-1 p-4">
                                                    {isAdmin && (
                                                        <div className="font-bold text-gray-900 dark:text-white mb-1 text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                            {req.Staff ? `${req.Staff.nome} ${req.Staff.cognome}` : <span className="text-gray-400 italic">Dipendente sconosciuto</span>}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded uppercase tracking-wider">{req.tipo}</span>
                                                        {req.endDate && req.endDate !== req.data && (
                                                            <span className="text-[10px] font-bold text-gray-400">PERIODO</span>
                                                        )}
                                                    </div>
                                                    {(req.startTime && req.endTime) && (
                                                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                                                            <Clock size={12} /> {req.startTime} – {req.endTime}
                                                        </p>
                                                    )}
                                                    {(req.dettagli || req.motivo) && (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2 italic">"{req.dettagli || req.motivo}"</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Admin actions overlay on hover */}
                                            {isAdmin && !isSelected && (
                                                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAction(req.id, 'approve'); }}
                                                        className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow-lg"
                                                        title="Approva"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleAction(req.id, 'reject'); }}
                                                        className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg"
                                                        title="Rifiuta"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
                                    <span className="text-[8px] uppercase font-bold opacity-60 mt-1">{format(d, 'MMM', { locale: it })}</span>
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
                                    <div className="bg-green-50 dark:bg-green-900/10 p-3 px-4 flex justify-between items-center border-b border-green-100 dark:border-green-900/30">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={group.items.length > 0 && group.items.every(r => selectedIds.has(r.id))}
                                                onChange={() => toggleSelectAll(group.items)}
                                                className="w-4 h-4 text-green-600 rounded cursor-pointer"
                                            />
                                            <h3 className="font-bold text-green-800 dark:text-green-300 text-sm uppercase tracking-wide">{group.label}</h3>
                                        </div>
                                        <div onClick={() => toggleGroup('a-' + key)} className="text-green-400 cursor-pointer p-1">
                                            {expandedGroups.has('a-' + key) ? <ChevronRight size={16} className="rotate-90 transition-transform" /> : <ChevronRight size={16} className="transition-transform" />}
                                        </div>
                                    </div>
                                    {expandedGroups.has('a-' + key) && (
                                        <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                                            {group.items.map((req, index) => {
                                                const dateInfo = formatDateHeader(req.data);
                                                const prevReq = index > 0 ? group.items[index - 1] : null;
                                                const isSameUser = prevReq && prevReq.staffId === req.staffId;
                                                const isSelected = selectedIds.has(req.id);
                                                return (
                                                    <div
                                                        key={req.id}
                                                        onClick={() => toggleSelection(req.id)}
                                                        className={`p-4 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition flex gap-4 items-start cursor-pointer ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                                                    >
                                                        <div className="flex flex-col items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-xl px-3 py-2 min-w-[64px] border border-green-200 dark:border-green-800 transition-transform group-hover:scale-105">
                                                            <span className="text-[9px] uppercase font-bold opacity-60 mb-0.5">{dateInfo.weekday}</span>
                                                            <span className="text-2xl font-black leading-none">{dateInfo.day}</span>
                                                            <span className="text-[9px] uppercase font-bold mt-0.5">{dateInfo.month}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    {(isAdmin && (!isSameUser || !req.Staff)) && (
                                                                        <div className="font-bold text-gray-900 dark:text-white text-lg leading-tight mb-1">
                                                                            {req.Staff ? `${req.Staff.nome} ${req.Staff.cognome}` : <span className="text-gray-400 italic text-sm">Dipendente sconosciuto</span>}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${req.tipo === 'DISPONIBILITA' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'}`}>{req.tipo}</span>
                                                                        {req.adminResponse && (<span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded italic truncate max-w-[200px]"><MessageSquare size={10} /> {req.adminResponse}</span>)}
                                                                    </div>
                                                                </div>
                                                                <Check size={18} className="text-green-500 flex-shrink-0 mt-1" />
                                                            </div>
                                                            {(req.startTime && req.endTime) && (<p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1.5 flex items-center gap-1.5"><Clock size={12} /> {req.startTime} – {req.endTime}</p>)}
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">{req.dettagli || req.motivo}</p>
                                                        </div>
                                                        {isAdmin && (
                                                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Eliminare questa richiesta?')) { api.deletePermissionRequest(req.id).then(loadData).catch(err => alert(err.message)); } }} className="text-gray-300 hover:text-red-500 p-2 transition-colors" title="Elimina"><Trash2 size={16} /></button>
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
                                    <div className="bg-red-50 dark:bg-red-900/10 p-3 px-4 flex justify-between items-center border-b border-red-100 dark:border-red-900/30">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={group.items.length > 0 && group.items.every(r => selectedIds.has(r.id))}
                                                onChange={() => toggleSelectAll(group.items)}
                                                className="w-4 h-4 text-red-600 rounded cursor-pointer"
                                            />
                                            <h3 className="font-bold text-red-800 dark:text-red-300 text-sm uppercase tracking-wide">{group.label}</h3>
                                        </div>
                                        <div onClick={() => toggleGroup('r-' + key)} className="text-red-400 cursor-pointer p-1">
                                            {expandedGroups.has('r-' + key) ? <ChevronRight size={16} className="rotate-90 transition-transform" /> : <ChevronRight size={16} className="transition-transform" />}
                                        </div>
                                    </div>
                                    {expandedGroups.has('r-' + key) && (
                                        <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                                            {group.items.map((req, index) => {
                                                const dateInfo = formatDateHeader(req.data);
                                                const prevReq = index > 0 ? group.items[index - 1] : null;
                                                const isSameUser = prevReq && prevReq.staffId === req.staffId;
                                                const isSelected = selectedIds.has(req.id);
                                                return (
                                                    <div
                                                        key={req.id}
                                                        onClick={() => toggleSelection(req.id)}
                                                        className={`p-4 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition flex gap-4 items-start cursor-pointer ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                                                    >
                                                        <div className="flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl px-3 py-2 min-w-[64px] border border-red-100 dark:border-red-900/30">
                                                            <span className="text-[9px] uppercase font-bold opacity-60 mb-0.5">{dateInfo.weekday}</span>
                                                            <span className="text-2xl font-black leading-none">{dateInfo.day}</span>
                                                            <span className="text-[9px] uppercase font-bold mt-0.5">{dateInfo.month}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    {(isAdmin && (!isSameUser || !req.Staff)) && (
                                                                        <div className="font-bold text-gray-900 dark:text-white text-lg leading-tight mb-1">
                                                                            {req.Staff ? `${req.Staff.nome} ${req.Staff.cognome}` : <span className="text-gray-400 italic text-sm text-gray-500">Dipendente sconosciuto</span>}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded uppercase tracking-wider">{req.tipo}</span>
                                                                        {req.adminResponse && (<span className="text-xs text-red-500 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded italic leading-tight"><MessageSquare size={10} /> {req.adminResponse}</span>)}
                                                                    </div>
                                                                </div>
                                                                <X size={18} className="text-red-400 flex-shrink-0 mt-1" />
                                                            </div>
                                                            {(req.startTime && req.endTime) && (<p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1.5 flex items-center gap-1.5"><Clock size={12} /> {req.startTime} – {req.endTime}</p>)}
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">{req.dettagli || req.motivo}</p>
                                                        </div>
                                                        {isAdmin && (
                                                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Eliminare questa richiesta?')) { api.deletePermissionRequest(req.id).then(loadData).catch(err => alert(err.message)); } }} className="text-gray-300 hover:text-red-500 p-2 transition-colors" title="Elimina"><Trash2 size={16} /></button>
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
                <button
                    onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm font-medium"
                >
                    <Plus size={18} /> Nuova Richiesta
                </button>
            </div>

            {/* Pending Section */}
            {pendingRequests.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Clock size={20} className="text-orange-500" />
                        In Attesa ({pendingRequests.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingRequests.map(req => (
                            <div key={req.id} className="bg-white p-5 rounded-xl shadow-sm border border-l-4 border-l-orange-400 border-gray-100 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-gray-800">{req.Staff?.nome} {req.Staff?.cognome}</div>
                                        <span className="text-xs font-bold px-2 py-1 bg-orange-100 text-orange-700 rounded uppercase">{req.tipo}</span>
                                    </div>
                                    <p className="text-gray-600 font-medium mb-1">{new Date(req.data).toLocaleDateString()}</p>
                                    <p className="text-sm text-gray-500 mb-3">{req.dettagli || req.motivo}</p>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                                        <button onClick={() => handleAction(req.id, 'approve')} className="flex-1 py-2 text-green-600 hover:bg-green-50 rounded font-medium transition text-sm">Approva</button>
                                        <button onClick={() => handleAction(req.id, 'reject')} className="flex-1 py-2 text-red-600 hover:bg-red-50 rounded font-medium transition text-sm">Rifiuta</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Complete Section */}
            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b font-bold text-gray-700 flex items-center gap-2">
                    <Search size={18} /> Storico ({historyRequests.length})
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white text-gray-500 uppercase font-semibold text-xs border-b">
                        <tr>
                            <th className="p-4">Richiedente</th>
                            <th className="p-4">Data</th>
                            <th className="p-4">Tipo</th>
                            <th className="p-4">Dettagli</th>
                            <th className="p-4 text-center">Stato</th>
                            <th className="p-4">Risposta Admin</th>
                            {isAdmin && <th className="p-4 text-right">Azioni</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {historyRequests.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nessuna richiesta nello storico.</td></tr>
                        )}
                        {historyRequests.map(req => (
                            <tr key={req.id} className="hover:bg-gray-50 transition">
                                <td className="p-4 font-medium text-gray-900">{req.Staff?.nome} {req.Staff?.cognome}</td>
                                <td className="p-4 text-gray-600">{new Date(req.data).toLocaleDateString()}</td>
                                <td className="p-4">
                                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded uppercase">{req.tipo}</span>
                                </td>
                                <td className="p-4 text-gray-500 max-w-xs truncate" title={req.dettagli}>{req.dettagli || req.motivo}</td>
                                <td className="p-4 text-center">
                                    {req.status === 'APPROVED' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold"><BadgeCheck size={14} /> Accettata</span>}
                                    {req.status === 'REJECTED' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold"><Ban size={14} /> Rifiutata</span>}
                                </td>
                                <td className="p-4 text-gray-500 italic text-xs">
                                    {req.adminResponse && (
                                        <div className="flex items-center gap-1">
                                            <MessageSquare size={12} /> {req.adminResponse}
                                            {req.User && <span className="text-gray-400"> - {req.User.name}</span>}
                                        </div>
                                    )}
                                </td>
                                {isAdmin && (
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={async () => {
                                                if (confirm('Sei sicuro di voler eliminare questa richiesta? Se era approvata, verrà rimossa anche l\'indisponibilità dal calendario.')) {
                                                    try {
                                                        await api.deletePermissionRequest(req.id);
                                                        loadData();
                                                    } catch (e: any) {
                                                        alert(e.message);
                                                    }
                                                }
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                                            title="Elimina richiesta"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {
                showNewModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                            <h3 className="text-xl font-bold mb-4">Nuova Richiesta</h3>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {isAdmin && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Dipendente (Admin)</label>
                                        <select
                                            className="w-full p-2 border rounded-lg bg-white mb-4"
                                            value={formData.staffId}
                                            onChange={e => setFormData({ ...formData, staffId: e.target.value })}
                                        >
                                            <option value="">-- Seleziona Dipendente --</option>
                                            {staffList.map((s: any) => (
                                                <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Durata</label>
                                    <div className="flex gap-2 mb-3">
                                        {['GIORNALIERO', 'PERIODO', 'ORARIO'].map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, mode: m })}
                                                className={`flex-1 py-2 text-xs font-bold rounded border ${formData.mode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
                                            >
                                                {m === 'GIORNALIERO' ? 'Giornaliero' : (m === 'PERIODO' ? 'Più Giorni' : 'Orario/Parziale')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">
                                            {formData.mode === 'PERIODO' ? 'Dal' : 'Data'}
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full p-2 border rounded-lg"
                                            value={formData.data}
                                            onChange={e => setFormData({ ...formData, data: e.target.value })}
                                        />
                                    </div>
                                    {formData.mode === 'PERIODO' && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Al</label>
                                            <input
                                                type="date"
                                                required
                                                className="w-full p-2 border rounded-lg"
                                                value={formData.endDate}
                                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>

                                {formData.mode === 'ORARIO' && (
                                    <div className="grid grid-cols-2 gap-4 bg-orange-50 p-3 rounded-lg border border-orange-100">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Dalle</label>
                                            <input type="time" required value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Alle</label>
                                            <input type="time" required value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} className="w-full p-2 border rounded" />
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Tipo Assenza</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={formData.tipo}
                                        onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                    >
                                        <option value="FERIE">Ferie</option>
                                        <option value="PERMESSO">Permesso</option>
                                        <option value="MALATTIA">Malattia</option>
                                        <option value="ALTRO">Altro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Motivazione (Categoria)</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={formData.motivo}
                                        onChange={e => setFormData({ ...formData, motivo: e.target.value })}
                                    >
                                        <option value="PERSONALE">Personale</option>
                                        <option value="SALUTE">Salute</option>
                                        <option value="FAMIGLIA">Famiglia</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Note / Dettagli</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg h-24 resize-none"
                                        placeholder="Inserisci dettagli aggiuntivi..."
                                        value={formData.dettagli}
                                        onChange={e => setFormData({ ...formData, dettagli: e.target.value })}
                                    ></textarea>
                                </div>

                                <div className="flex gap-3 pt-4 border-t mt-4">
                                    <button type="button" onClick={() => setShowNewModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition">Annulla</button>
                                    <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition">Invia Richiesta</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
