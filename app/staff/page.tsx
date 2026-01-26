'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import { Trash2, Edit2, Upload, Plus, X, Save, Grid3x3, List, Eraser, Settings, Clock } from 'lucide-react';
import StationsManagerModal from '@/components/StationsManagerModal';
import AvailabilityManager from '@/components/AvailabilityManager';

interface Staff {
    id: number;
    nome: string;
    cognome: string;
    ruolo: string;
    email: string | null;
    oreMinime: number;
    oreMassime: number;
    costoOra: number;
    postazioni: string[];
    skillLevel?: string;
    contractType?: string;
}

export default function StaffPage() {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const [form, setForm] = useState({
        nome: '',
        cognome: '',
        email: '',
        ruolo: '',
        oreMinime: 0,
        oreMassime: 40,
        costoOra: 0,
        postazioni: [] as string[],
        skillLevel: 'MEDIUM',
        contractType: 'STANDARD'
    });

    const [availableStations, setAvailableStations] = useState(['BAR SU', "BAR GIU'", 'B/S', 'PASS', 'CDR', 'ACC', 'CUCINA']);
    const [newStation, setNewStation] = useState('');
    const [showStationsManager, setShowStationsManager] = useState(false);
    const [managingAvailability, setManagingAvailability] = useState<{ id: number; nome: string } | null>(null);

    const handleAddStation = (e?: any) => {
        if (e) e.preventDefault();
        if (!newStation) return;
        const up = newStation.trim().toUpperCase();
        if (!availableStations.includes(up)) {
            setAvailableStations([...availableStations, up]);
            setForm({ ...form, postazioni: [...form.postazioni, up] });
        }
        setNewStation('');
    };

    // Helper function to capitalize names properly
    const capitalizeName = (name: string) => {
        if (!name) return '';
        return name
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    useEffect(() => {
        loadStaff();
    }, []);

    async function loadStaff() {
        setLoading(true);
        try {
            const data = await api.getStaff();
            data.sort((a: any, b: any) => (a.listIndex ?? 999) - (b.listIndex ?? 999));
            setStaff(data);

            // Merge custom stations found in existing staff
            const used = new Set(data.flatMap((s: any) => (s.postazioni || []) as string[]));
            setAvailableStations(prev => Array.from(new Set([...prev, ...used])) as string[]);
        } catch (e: any) {
            console.error(e);
            alert('Errore caricamento staff: ' + (e.message || JSON.stringify(e)));
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit() {
        try {
            const payload: any = {
                ...form,
                oreMinime: parseInt(String(form.oreMinime)) || 0,
                oreMassime: parseInt(String(form.oreMassime)) || 40,
                costoOra: parseFloat(String(form.costoOra)) || 0,
                email: form.email && form.email.trim() !== '' ? form.email.trim() : null,
                postazioni: Array.isArray(form.postazioni) ? form.postazioni : []
            };

            // Remove properties that might be misinterpreted or read-only if present
            // (Though ...form usually matches state)

            // If email is null, delete it to match previous logic logic (if logic relied on missing key)?
            if (!payload.email) delete payload.email;

            if (editing) {
                console.log('Updating staff:', editing, payload);
                if (!editing) throw new Error("ID mancante per la modifica");
                await api.updateStaff(editing, payload);
                setEditing(null);
            } else {
                await api.upsertStaff(payload);
            }

            await loadStaff();
            resetForm();
            setShowForm(false);
        } catch (e: any) {
            alert("Errore salva/aggiorna: " + e.message);
        }
    }

    function resetForm() {
        setForm({
            nome: '',
            cognome: '',
            email: '',
            ruolo: '',
            oreMinime: 0,
            oreMassime: 40,
            costoOra: 0,
            postazioni: [],
            skillLevel: 'MEDIUM',
            contractType: 'STANDARD'
        });
        setEditing(null);
    }

    function startEdit(s: Staff) {
        setEditing(s.id);
        setForm({
            nome: s.nome,
            cognome: s.cognome || '',
            email: s.email || '',
            ruolo: s.ruolo,
            oreMinime: s.oreMinime,
            oreMassime: s.oreMassime,
            costoOra: s.costoOra,
            postazioni: Array.isArray(s.postazioni) ? s.postazioni : [],
            skillLevel: s.skillLevel || 'MEDIUM',
            contractType: s.contractType || 'STANDARD'
        });
        setShowForm(true);
    }

    async function removeRow(id: number, nome: string) {
        if (!confirm(`Eliminare ${nome}?`)) return;
        try {
            await api.deleteStaff(id);
            await loadStaff();
        } catch (e: any) { alert('Errore cancellazione: ' + e.message) }
    }

    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result as string;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Logic copied from legacy with types adapted
                let headerRowIndex = -1;
                const requiredCols = ['nome', 'name', 'dipendente', 'personale', 'collaboratore', 'staff'];

                for (let i = 0; i < Math.min(rows.length, 50); i++) {
                    const row = rows[i] as any[];
                    const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
                    if (requiredCols.some(r => rowStr.includes(r))) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    if (!confirm("Non ho trovato intestazioni chiare. Usare la prima riga?")) return;
                    headerRowIndex = 0;
                }

                const headers = (rows[headerRowIndex] as any[]).map(h => String(h).trim().toLowerCase());
                const getColIdx = (...search: string[]) => headers.findIndex(h => search.some(s => h.includes(s)));

                const idxNome = getColIdx('nome', 'name', 'dipendente', 'first', 'personale');
                const idxCognome = getColIdx('cognome', 'surname', 'last', 'family');
                const idxEmail = getColIdx('email', 'e-mail', 'mail', 'indirizzo');
                const idxRuolo = getColIdx('ruolo', 'role', 'mansione', 'job', 'posizione', 'livello');
                const idxMin = getColIdx('min', 'ore min');
                const idxMax = getColIdx('max', 'ore max', 'ore settimanali');
                const idxCosto = getColIdx('costo', 'cost', 'tariffa', 'paga', 'retribuzione');
                const idxPost = getColIdx('postazioni', 'stations', 'skills', 'abilità', 'dove', 'reparto');

                if (idxNome === -1) {
                    alert("Colonna 'Nome' non trovata.");
                    return;
                }

                const payload = rows.slice(headerRowIndex + 1).map((row: any[], index: number) => {
                    if (!row[idxNome]) return null;

                    let nome = String(row[idxNome]).trim();
                    let cognome = idxCognome > -1 ? String(row[idxCognome] || '').trim() : '';

                    if (!cognome && nome.includes(' ')) {
                        const parts = nome.split(' ');
                        nome = parts[0];
                        cognome = parts.slice(1).join(' ');
                    }

                    return {
                        nome,
                        cognome,
                        email: idxEmail > -1 ? row[idxEmail] : undefined,
                        ruolo: idxRuolo > -1 ? row[idxRuolo] : 'Staff',
                        oreMinime: idxMin > -1 ? (row[idxMin] || 0) : 0,
                        oreMassime: idxMax > -1 ? (row[idxMax] || 40) : 40,
                        costoOra: idxCosto > -1 ? (row[idxCosto] || 0) : 0,
                        postazioni: idxPost > -1 && row[idxPost] ? String(row[idxPost]).split(',').map(s => s.trim()).filter(x => x) : [],
                        listIndex: index // Explicitly set order from file
                    };
                }).filter(p => p !== null);

                if (payload.length === 0) {
                    alert("Nessun dato trovato.");
                    return;
                }

                // Prompt for Replace or Append
                let shouldReplace = false;
                if (staff.length > 0) {
                    const choice = confirm(`Trovati ${payload.length} dipendenti.\n\nVuoi SOSTITUIRE l'intera lista esistente con questi nuovi dati?\n(OK = Sostituisci e cancella vecchi, ANNULLA = Aggiungi in coda)`);
                    shouldReplace = choice;
                }

                if (shouldReplace) {
                    await api.deleteAllStaff();
                }

                await api.importStaff(payload);
                alert(`Importazione completata.`);
                await loadStaff();
            } catch (err: any) {
                alert("Errore importazione: " + err.message);
            }
        };
        reader.readAsBinaryString(file);
    }



    // UI Components
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-gray-800">Personale</h1>
                    {/* View Toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Vista a Cards"
                        >
                            <Grid3x3 size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded transition ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Vista Elenco"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { resetForm(); setShowForm(!showForm); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        {showForm ? <X size={20} /> : <Plus size={20} />}
                        {showForm ? 'Chiudi' : 'Nuovo Dipendente'}
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition cursor-pointer">
                        <Upload size={20} />
                        Importa Excel
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv, .xlsx, .xls" />
                    </label>
                    <button
                        onClick={() => setShowStationsManager(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                        title="Gestisci elenco postazioni globalmente"
                    >
                        <Settings size={20} />
                        Gestisci Postazioni
                    </button>
                    <button
                        onClick={async () => {
                            if (confirm('⚠️ SEI SICURO? Questo cancellerà TUTTO lo staff esistente. Usa questa funzione se vuoi ricaricare da zero con l\'ordine corretto.')) {
                                try {
                                    await api.deleteAllStaff();
                                    await loadStaff();
                                    alert('Staff azzerato.');
                                } catch (e: any) { alert('Errore: ' + e.message); }
                            }
                        }}
                        className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                        title="Elimina Tutto lo Staff"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">{editing ? 'Modifica Dipendente' : 'Nuovo Dipendente'}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                            <input className="w-full p-2 border rounded-md" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                            <input className="w-full p-2 border rounded-md" value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                            <input className="w-full p-2 border rounded-md" value={form.ruolo} onChange={e => setForm({ ...form, ruolo: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input className="w-full p-2 border rounded-md" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ore Minime</label>
                            <input type="number" className="w-full p-2 border rounded-md" value={form.oreMinime} onChange={e => setForm({ ...form, oreMinime: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ore Massime</label>
                            <input type="number" className="w-full p-2 border rounded-md" value={form.oreMassime} onChange={e => setForm({ ...form, oreMassime: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costo Orario (€)</label>
                            <input type="number" className="w-full p-2 border rounded-md" value={form.costoOra} onChange={e => setForm({ ...form, costoOra: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Livello Skill</label>
                            <select
                                className="w-full p-2 border rounded-md bg-white"
                                value={form.skillLevel}
                                onChange={e => setForm({ ...form, skillLevel: e.target.value })}
                            >
                                <option value="JUNIOR">Junior</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="SENIOR">Senior</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Contratto</label>
                            <select
                                className="w-full p-2 border rounded-md bg-white"
                                value={form.contractType}
                                onChange={e => {
                                    const val = e.target.value;
                                    const updates: any = { contractType: val };
                                    if (val === 'CHIAMATA') {
                                        updates.oreMassime = 0; // Auto-set 0 for On-Call
                                    }
                                    setForm({ ...form, ...updates });
                                }}
                            >
                                <option value="STANDARD">Standard (Fisso)</option>
                                <option value="TIROCINANTE">Tirocinante</option>
                                <option value="CHIAMATA">A Chiamata</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Postazioni Abilitate</label>
                        <div className="flex flex-wrap gap-2 items-center">
                            {availableStations.map(p => (
                                <label key={p} className={`px-3 py-1 rounded-full border cursor-pointer text-sm transition ${form.postazioni.includes(p) ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-gray-50 border-gray-200 text-gray-600'
                                    }`}>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={form.postazioni.includes(p)}
                                        onChange={() => {
                                            const newPost = form.postazioni.includes(p)
                                                ? form.postazioni.filter(x => x !== p)
                                                : [...form.postazioni, p];
                                            setForm({ ...form, postazioni: newPost });
                                        }}
                                    />
                                    {p}
                                </label>
                            ))}
                            <div className="flex items-center gap-1 ml-2">
                                <input
                                    className="border rounded px-2 py-1 text-xs w-24 outline-indigo-500 bg-gray-50 focus:bg-white transition"
                                    placeholder="Nuova..."
                                    value={newStation}
                                    onChange={e => setNewStation(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddStation(e); }}
                                />
                                <button onClick={handleAddStation} className="p-1.5 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition" title="Aggiungi Postazione">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        >
                            Annulla
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                        >
                            <Save size={18} />
                            {editing ? 'Salva Modifiche' : 'Salva Dipendente'}
                        </button>
                    </div>
                </div>
            )}
            {
                loading ? (
                    <div className="text-center py-10 text-gray-500">Caricamento staff...</div>
                ) : staff.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                        <div className="text-gray-400 text-lg mb-2">Nessun dipendente trovato</div>
                        <p className="text-gray-500 text-sm">Aggiungine uno o importa da Excel</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    // GRID VIEW (Cards)
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {staff.map(s => {
                            const initials = `${s.nome[0] || ''}${s.cognome?.[0] || ''}`.toUpperCase();
                            const skillColors = {
                                SENIOR: 'from-purple-500 to-purple-600',
                                MEDIUM: 'from-blue-500 to-blue-600',
                                JUNIOR: 'from-orange-500 to-orange-600'
                            };
                            const skillColor = skillColors[s.skillLevel as keyof typeof skillColors] || 'from-gray-500 to-gray-600';

                            return (
                                <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden group">
                                    {/* Header with Avatar */}
                                    <div className="p-6 pb-4">
                                        <div className="flex items-start gap-4">
                                            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${skillColor} flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0`}>
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-gray-900 truncate">
                                                    {capitalizeName(s.nome)} {capitalizeName(s.cognome)}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                                                        {s.ruolo}
                                                    </span>
                                                    {s.skillLevel && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.skillLevel === 'SENIOR' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                            s.skillLevel === 'JUNIOR' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                                'bg-blue-50 text-blue-700 border-blue-200'
                                                            }`}>
                                                            {s.skillLevel}
                                                        </span>
                                                    )}
                                                    {s.contractType && s.contractType !== 'STANDARD' && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.contractType === 'CHIAMATA' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                                            'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                            }`}>
                                                            {s.contractType === 'CHIAMATA' ? 'A CHIAMATA' : 'TIROCINANTE'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info Section */}
                                    <div className="px-6 pb-4 space-y-3">
                                        {s.email && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                <span className="text-gray-600 truncate">{s.email}</span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 rounded-lg p-3">
                                                <div className="text-xs text-gray-500 mb-1">Ore Contratto</div>
                                                <div className="text-sm font-bold text-gray-900">{s.oreMinime} - {s.oreMassime}h</div>
                                            </div>
                                            {s.costoOra > 0 && (
                                                <div className="bg-emerald-50 rounded-lg p-3">
                                                    <div className="text-xs text-emerald-600 mb-1">Costo Orario</div>
                                                    <div className="text-sm font-bold text-emerald-700">€{s.costoOra}</div>
                                                </div>
                                            )}
                                        </div>

                                        {s.postazioni.length > 0 && (
                                            <div>
                                                <div className="text-xs text-gray-500 mb-2">Postazioni</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {s.postazioni.map(p => (
                                                        <span key={p} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-100">
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions Footer */}
                                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                                        <button
                                            onClick={() => startEdit(s)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition text-sm font-medium"
                                            title="Modifica"
                                        >
                                            <Edit2 size={14} />
                                            Modifica
                                        </button>
                                        <button
                                            onClick={() => setManagingAvailability({ id: s.id, nome: `${s.nome} ${s.cognome}` })}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition text-sm font-medium"
                                            title="Disponibilità"
                                        >
                                            <Clock size={14} />
                                            Orari
                                        </button>
                                        <button
                                            onClick={() => removeRow(s.id, s.nome)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition text-sm font-medium"
                                            title="Elimina"
                                        >
                                            <Trash2 size={14} />
                                            Elimina
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // LIST VIEW (Table)
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ruolo</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ore (Min-Max)</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Costo</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Postazioni</th>
                                    <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {staff.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50 transition">
                                        <td className="p-4 font-medium text-gray-900">
                                            {capitalizeName(s.nome)} {capitalizeName(s.cognome)}
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            <div className="flex flex-col gap-1">
                                                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold w-fit">{s.ruolo}</span>
                                                {s.skillLevel && (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit border ${s.skillLevel === 'SENIOR' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                        s.skillLevel === 'JUNIOR' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                            'bg-blue-100 text-blue-700 border-blue-200'
                                                        }`}>
                                                        {s.skillLevel}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-500 text-sm">{s.email || '-'}</td>
                                        <td className="p-4 text-gray-600 text-sm">{s.oreMinime} - {s.oreMassime}</td>
                                        <td className="p-4 text-gray-600 text-sm">{s.costoOra > 0 ? `€${s.costoOra}` : '-'}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {s.postazioni.slice(0, 3).map(p => (
                                                    <span key={p} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{p}</span>
                                                ))}
                                                {s.postazioni.length > 3 && (
                                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">+{s.postazioni.length - 3}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => startEdit(s)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                                                    title="Modifica"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setManagingAvailability({ id: s.id, nome: `${s.nome} ${s.cognome}` })}
                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                                                    title="Disponibilità"
                                                >
                                                    <Clock size={16} />
                                                </button>
                                                <button
                                                    onClick={() => removeRow(s.id, s.nome)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition"
                                                    title="Elimina"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }
            <StationsManagerModal
                isOpen={showStationsManager}
                onClose={() => setShowStationsManager(false)}
                staff={staff}
                onRefresh={loadStaff}
                availableStations={availableStations}
                onUpdateStations={setAvailableStations}
            />
            {managingAvailability && (
                <AvailabilityManager
                    staffId={managingAvailability.id}
                    staffName={managingAvailability.nome}
                    onClose={() => setManagingAvailability(null)}
                />
            )}
        </div>
    );
}
