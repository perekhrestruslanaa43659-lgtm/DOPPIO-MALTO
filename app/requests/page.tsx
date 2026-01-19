
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { BadgeCheck, Ban, Clock, Plus, Search, Filter, MessageSquare, User, Trash2 } from 'lucide-react';

interface Request {
    id: number;
    staffId: number;
    data: string;
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
    const [staffList, setStaffList] = useState<any[]>([]); // To populate select if admin

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
    const historyRequests = displayedRequests.filter(r => r.status !== 'PENDING');

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
        <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Richieste Permessi (Pianificate)</h1>
                    <p className="text-gray-500">Gestione di Ferie e Permessi <strong>richiesti in anticipo</strong>. (Tot: {displayedRequests.length})</p>
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
