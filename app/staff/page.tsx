
'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import { Trash2, Edit2, Upload, Plus, X, Save } from 'lucide-react';

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
}

export default function StaffPage() {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({
        nome: '',
        cognome: '',
        email: '',
        ruolo: '',
        oreMinime: 0,
        oreMassime: 40,
        costoOra: 0,
        postazioni: [] as string[]
    });

    const availableStations = ['BAR SU', "BAR GIU'", 'B/S', 'PASS', 'CDR', 'ACC', 'CUCINA'];

    useEffect(() => {
        loadStaff();
    }, []);

    async function loadStaff() {
        setLoading(true);
        try {
            const data = await api.getStaff();
            setStaff(data);
        } catch (e) {
            console.error(e);
            alert('Errore caricamento staff');
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit() {
        try {
            const payload: any = { ...form };
            if (!payload.email) delete payload.email;

            if (editing) {
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
            postazioni: []
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
            postazioni: Array.isArray(s.postazioni) ? s.postazioni : []
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

                const payload = rows.slice(headerRowIndex + 1).map((row: any[]) => {
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
                        postazioni: idxPost > -1 && row[idxPost] ? String(row[idxPost]).split(',').map(s => s.trim()) : [] // Adapt to string[]
                    };
                }).filter(p => p !== null);

                if (payload.length === 0) {
                    alert("Nessun dato trovato.");
                    return;
                }

                if (confirm(`Trovate ${payload.length} righe. Importare?`)) {
                    await api.importStaff(payload);
                    alert(`Importazione completata.`);
                    await loadStaff();
                }
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
                <h1 className="text-3xl font-bold text-gray-800">Personale</h1>
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
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls" />
                    </label>
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Postazioni Abilitate</label>
                        <div className="flex flex-wrap gap-2">
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

            {loading ? (
                <div className="text-center py-10 text-gray-500">Caricamento staff...</div>
            ) : (
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
                                    <td className="p-4 font-medium text-gray-900">{s.nome} {s.cognome}</td>
                                    <td className="p-4 text-gray-600">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{s.ruolo}</span>
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
                            {staff.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-400">
                                        Nessun dipendente trovato. Aggiungine uno o importa da Excel.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
