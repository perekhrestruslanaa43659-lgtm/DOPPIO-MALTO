'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import { Trash2, Edit2, Upload, Plus, X, Save, Grid3x3, List, Eraser, Settings, Clock, Star } from 'lucide-react';
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
    listIndex?: number;
    productivityWeight?: number;
}

// Configurazione Categorie e Colori
const CATEGORIE_POSTAZIONI = {
    SALA: { color: 'blue', tag: ['CDR', 'B/S', 'ACC', 'BAR SU', 'BAR GIU', 'ACCOGLIENZA'], label: 'Sala' },
    CUCINA: { color: 'red', tag: ['BURGER', 'FRITTI', 'PIRA', 'PREPARAZIONE', 'DOLCI/INS', 'PIZZA'], label: 'Cucina' },
    JOLLY: { color: 'yellow', tag: ['SCARICO', 'LAVAGGIO', 'JOLLY'], label: 'Servizi' }
};

const renderSkillLevel = (level: string) => {
    const levels: any = { 'Senior': '⚡⚡⚡', 'Medium': '⚡⚡', 'In formazione': '⚡', 'SENIOR': '⚡⚡⚡', 'MEDIUM': '⚡⚡', 'JUNIOR': '⚡' };
    return levels[level] || '⚡';
};

// Funzione di pulizia per la visualizzazione nelle card
// Ora accetta callback interattive
const interactPostazioni = (
    postazioniRaw: string[],
    onRemove: (p: string) => void,
    readOnly: boolean = false
) => {
    // Rimuove duplicati come BARSU/BAR SU
    const unique = [...new Set(postazioniRaw.map(p => p.replace('BARSU', 'BAR SU').replace('BARGIU', 'BAR GIU')))];

    return unique.map(p => {
        let category = Object.values(CATEGORIE_POSTAZIONI).find(c => c.tag.includes(p.toUpperCase())) || { color: 'gray' };
        return (
            <span key={p} className={`group relative px-2 py-1 rounded text-xs font-medium border mr-1 mb-1 inline-flex items-center gap-1
        ${category.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    category.color === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
                        category.color === 'yellow' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'}`}>
                {p === 'CDR' ? 'CDR' : p}
                {!readOnly && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(p); }}
                        className="hidden group-hover:block p-0.5 hover:bg-red-100 hover:text-red-600 rounded-full"
                        title="Rimuovi"
                    >
                        <X size={10} />
                    </button>
                )}
            </span>
        );
    });
};

export default function StaffPage() {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const [form, setForm] = useState<{
        nome: string;
        cognome: string;
        email: string;
        ruolo: string;
        oreMinime: number | string;
        oreMassime: number | string;
        costoOra: number | string;
        postazioni: string[];
        skillLevel: string;
        contractType: string;
        productivityWeight: number;
    }>({
        nome: '',
        cognome: '',
        email: '',
        ruolo: '',
        oreMinime: 0,
        oreMassime: 40,
        costoOra: 0,
        postazioni: [] as string[],
        skillLevel: 'MEDIUM',
        contractType: 'STANDARD',
        productivityWeight: 1.0
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

    // Quick Update for Interactive Badges
    const quickUpdateStations = async (id: number, currentStations: string[], station: string, action: 'add' | 'remove') => {
        try {
            let newStations = [...currentStations];
            if (action === 'remove') {
                newStations = newStations.filter(s => s !== station);
            } else {
                if (!newStations.includes(station)) newStations.push(station);
            }

            // Optimistic Update
            setStaff(prev => prev.map(s => s.id === id ? { ...s, postazioni: newStations } : s));

            await api.updateStaff(id, { postazioni: newStations });
        } catch (e: any) {
            alert("Errore aggiornamento rapido: " + e.message);
            // Revert on error? Skipping for simplicity, usually safe.
            loadStaff();
        }
    };

    const quickUpdateCost = async (id: number, newCost: number) => {
        try {
            // Optimistic Update
            setStaff(prev => prev.map(s => s.id === id ? { ...s, costoOra: newCost } : s));
            await api.updateStaff(id, { costoOra: newCost });
        } catch (e: any) {
            alert("Errore aggiornamento costo: " + e.message);
            loadStaff();
        }
    };

    const quickUpdateHours = async (id: number, min: number, max: number) => {
        try {
            // Optimistic Update
            setStaff(prev => prev.map(s => s.id === id ? { ...s, oreMinime: min, oreMassime: max } : s));
            await api.updateStaff(id, { oreMinime: min, oreMassime: max });
        } catch (e: any) {
            alert("Errore aggiornamento ore: " + e.message);
            loadStaff();
        }
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


    // --- Helper for Role Priority ---
    // Moved outside or kept here but accessible.
    // For simplicity, we define it inside component but outside loadStaff to be reusable.
    // Actually, let's keep it here but make sure we use it in handleSubmit.

    const getRolePriority = (s: any) => {
        const role = (s.ruolo || '').toLowerCase();
        const name = (s.nome || '').toLowerCase();
        const cognome = (s.cognome || '').toLowerCase();

        // ── HARD PIN: Luca Gnecco always first ──
        if (name.includes('luca') && cognome.includes('gnecco')) return 0;

        // --- AREA SALA ---
        // 1. Direttore (DIR / RM)
        if (role === 'dir' || role === 'rm' || role.includes('store') || role.includes('general') || role.includes('titolare') || role.includes('proprietario')) return 10;

        // 2. Vice Direttore (VD / VRM)
        if (role === 'vd' || role === 'vrm' || role.includes('vice')) return 20;

        // 3. Junior Manager (JM) - Juan Special
        if (name.includes('juan')) return 35;
        if (role === 'jm' || role.includes('junior')) return 30;

        // [Generic Manager] (If not caught above)
        if (role.includes('manager') || role.includes('responsabile') || role.includes('direttore')) return 25;

        // 3.5 Trainees
        if (role.includes('formazione') || role.includes('apprendista') || role.includes('training')) return 38;

        // 4. Operatori Sala (OP)
        if (role === 'op' || role === 'ops' || role.includes('sala') || role.includes('cameriere') || role.includes('barista') || role.includes('runner') || role.includes('operatore')) return 40;
        if (role.includes('supporto') || role.includes('extra') || role.includes('trasferte') || role.includes('stagista') || name.includes('supporto')) return 45;

        // --- AREA CUCINA ---
        // 1. Capo Cucina (CC)
        if (role === 'cc' || role.includes('chef') || role.includes('capo cucina')) return 50;

        // 2. Manager Cucina (MC)
        if (role === 'mc' || (role.includes('manager') && role.includes('cucina'))) return 60;

        // 3. Operatori Cucina (OC)
        if (role === 'oc' || role.includes('cucina') || role.includes('cuoco') || role.includes('pizzaiolo') || role.includes('lavapiatti')) return 70;

        return 99;
    };

    async function loadStaff() {
        setLoading(true);
        try {
            const data = await api.getStaff();

            data.sort((a: any, b: any) => {
                // Primary: Role Priority (STRICT HIERARCHY)
                const pA = getRolePriority(a);
                const pB = getRolePriority(b);
                if (pA !== pB) return pA - pB;

                // Secondary: listIndex (for manual tweaks within same role)
                const idxA = a.listIndex ?? 9999;
                const idxB = b.listIndex ?? 9999;
                if (idxA !== idxB) return idxA - idxB;

                // Tertiary: Name
                return (a.nome || '').localeCompare(b.nome || '');
            });

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
                oreMinime: form.oreMinime === '' ? 0 : Number(form.oreMinime),
                oreMassime: form.oreMassime === '' ? 0 : Number(form.oreMassime),
                costoOra: form.costoOra === '' ? 0 : Number(form.costoOra),
                email: form.email && form.email.trim() !== '' ? form.email.trim() : null,
                postazioni: Array.isArray(form.postazioni) ? form.postazioni : []
            };

            if (!payload.email) delete payload.email;

            if (editing) {
                console.log('Updating staff:', editing, payload);
                if (!editing) throw new Error("ID mancante per la modifica");
                await api.updateStaff(editing, payload);
                setEditing(null);
            } else {
                // NEW INSERTION LOGIC
                // 1. Calculate Priority of new user
                const newPrio = getRolePriority(payload);

                // 2. Find insertion index based on current 'staff' state which is sorted by listIndex
                // We want to insert AFTER the last person of the same or better priority, 
                // but BEFORE the first person of a WORSE priority (higher number).
                // Actually, just find the first person with priority > newPrio.
                // Insert there.

                let insertIndex = staff.length; // Default to end

                // We trust 'staff' is sorted by listIndex.
                // We look for the first person whose role priority is strictly "worse" (higher number) than newPrio.
                // UNLESS they have been manually moved?
                // The user says "rispettando i ruoli". So we should respect the role blocks.

                // Let's refine:
                // If I add a JM (30):
                // I iterate.
                // Director (10) -> Keep going
                // Vice (20) -> Keep going
                // JM A (30) -> Keep going (add after existing JMs)
                // Juan (35) -> STOP! 35 > 30. Insert HERE.

                // What if the list is manual and dirty?
                // Example: Director (idx 0), Sala (idx 1), JM (idx 2).
                // JM is out of place. 
                // If I add new JM, where does it go?
                // If I use "first with P > 30", I find Sala (40) at idx 1.
                // So I insert at idx 1.
                // Result: Director, NEW JM, Sala, OLD JM.
                // This seems "safe" to correct the order locally, but might be weird if user intentionally moved JM down.
                // But user allows manual override.
                // "Nuovi vengono aggiunti in fondo alla lista [del ruolo]".
                // The most robust way is to find the LAST person with priority <= newPrio, and insert after them.

                let targetIndex = -1;
                for (let i = 0; i < staff.length; i++) {
                    const p = getRolePriority(staff[i]);
                    if (p <= newPrio) {
                        targetIndex = i;
                    }
                }
                // targetIndex is the index of the last person with same or better rank.
                // We insert at targetIndex + 1.
                insertIndex = targetIndex + 1;

                // If targetIndex was -1 (everyone is worse, e.g. adding Director when only Sala exist), 
                // insertIndex = 0. Correct.

                // If everyone is better (adding Kitchen when only Directors exist),
                // targetIndex = last index. insertIndex = length. Correct.

                // 3. Shift indices if necessary
                // We need to update everyone from insertIndex onwards.
                const shifts = [];
                // We assign somewhat "safe" huge numbers first? No, just loop.
                // Since there is no uniqueness constraint usually on listIndex, we can just update.
                // We'll update the frontend state assumption.

                // We need to update DB for these shifted users.
                // Note: staff[i].listIndex might be null or scattered. 
                // We should assume a dense packing or just shift relatively?
                // Let's assume we want to maintain an integer sequence corresponding to the visual order.
                // Visual order is crucial.

                // Let's grab the current visual order (mapped from current staff state).
                // We inject the new item at insertIndex.
                // Then re-index everyone from 0 to N.
                const newOrder = [...staff];
                // We don't have the new ID yet, so we can't put it in the list perfectly for a batch update call...
                // But we can update the OTHERS first.

                // Actually, simplest strategy:
                // Just use api.upsertStaff with the calculated listIndex?
                // If I say listIndex = 5, and there is already a 5, what happens?
                // They overlap. Sort is indeterminate.
                // We MUST shift.

                // Optimization: Shift only if conflict?
                // No, "Insert" implies shifting.

                // Let's shift everyone >= insertIndex by +1.
                // We filter staff from memory.
                const toShift = staff.filter((_, idx) => idx >= insertIndex);

                // We'll update them in background or await? Await to ensure consistency.
                if (toShift.length > 0) {
                    // Since we don't know the exact listIndex values (they might be 100, 200...),
                    // we should probably just increment their current `listIndex`.
                    // But if the previous logic was just (a,b) => listIndex - listIndex,
                    // we assume they are ordered.
                    // Let's just increment their existing listIndex + 1.
                    await Promise.all(toShift.map(s => api.updateStaff(s.id, { listIndex: (s.listIndex || 0) + 1 })));
                }

                // Now insert the new one
                // We need to know what listIndex to give it.
                // Ideally: (prevItem.listIndex + nextItem.listIndex) / 2?
                // No, we use Integers.
                // If we shifted everyone down, the slot at `insertIndex` (conceptually) is free relative to the count?
                // Wait. If staff[insertIndex] had listIndex 5. We shifted it to 6.
                // So 5 is free? Only if staff[insertIndex-1] was < 5.
                // If staff[insertIndex-1] was 4, then yes 5 is free.
                // If staff[insertIndex-1] was also 5 (duplicate), then we have issue.

                // Let's calculate the listIndex to assign.
                let prevIndex = -1;
                if (insertIndex > 0) {
                    prevIndex = staff[insertIndex - 1].listIndex ?? (insertIndex - 1);
                }
                const assignedIndex = prevIndex + 1;

                // But wait, if we only shifted the ones starting from `insertIndex`,
                // and we assumed their old indices were >= assignedIndex...
                // This is getting risky with sparse arrays.

                // SAFE & SLOW APPROACH (for <50 staff):
                // 1. Insert placeholder in local array.
                // 2. Re-assign listIndex 0..N for EVERYONE.
                // 3. Update everyone.

                // Reassigning everyone ensures clean 0,1,2,3 order.
                // We can skip the API call for the new guy here, pass it in upsert.
                // We update existing users first.

                const proposedList = [...staff];
                const placeholder = { ...payload, id: -1, listIndex: 0 }; // Temporary
                proposedList.splice(insertIndex, 0, placeholder);

                // Now proposedList matches desired order.
                // Calculate updates for existing users whose index changed.
                const updates = [];
                for (let i = 0; i < proposedList.length; i++) {
                    const item = proposedList[i];
                    if (item.id !== -1) {
                        // If index is different, update
                        if (item.listIndex !== i) {
                            updates.push(api.updateStaff(item.id, { listIndex: i }));
                        }
                    }
                }

                if (updates.length > 0) await Promise.all(updates);

                // Finally create the new one with the correct index
                const finalIndex = proposedList.findIndex(x => x.id === -1);
                payload.listIndex = finalIndex;

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
            contractType: 'STANDARD',
            productivityWeight: 1.0
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
            contractType: s.contractType || 'STANDARD',
            productivityWeight: s.productivityWeight !== undefined ? s.productivityWeight : 1.0
        });
        setShowForm(true);
        // Auto-scroll to form
        setTimeout(() => {
            const formElement = document.getElementById('staff-form-section');
            if (formElement) {
                formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
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



    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    // UI Components
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Personale</h1>
                    {/* View Toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 p-1 rounded-lg transition-colors">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded transition ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            title="Vista a Cards"
                        >
                            <Grid3x3 size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded transition ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
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
                <div id="staff-form-section" className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-100 dark:border-slate-700 transition-colors">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-white">{editing ? 'Modifica Dipendente' : 'Nuovo Dipendente'}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
                            <input className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} onKeyDown={handleKeyDown} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cognome</label>
                            <input className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })} onKeyDown={handleKeyDown} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruolo</label>
                            <input className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={form.ruolo} onChange={e => setForm({ ...form, ruolo: e.target.value })} onKeyDown={handleKeyDown} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                            <input className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} onKeyDown={handleKeyDown} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ore Minime</label>
                            <input
                                type="number"
                                className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={form.oreMinime}
                                onChange={e => {
                                    const val = e.target.value;
                                    setForm({ ...form, oreMinime: val === '' ? '' : parseInt(val) });
                                }}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ore Massime</label>
                            <input
                                type="number"
                                className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={form.oreMassime}
                                onChange={e => {
                                    const valStr = e.target.value;
                                    const val = valStr === '' ? '' : parseInt(valStr);

                                    // Auto-update Role if it's generic
                                    const currentRole = form.ruolo.toLowerCase();
                                    if (typeof val === 'number' && (currentRole === 'operatore' || currentRole === 'ops' || currentRole === 'staff' || currentRole.match(/^(staff|ops) \d+h$/))) {
                                        setForm({ ...form, oreMassime: val, ruolo: `OPS ${val}h` });
                                    } else {
                                        setForm({ ...form, oreMassime: val });
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Costo Orario (€)</label>
                            <input
                                type="number"
                                className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={form.costoOra}
                                onChange={e => {
                                    const val = e.target.value;
                                    setForm({ ...form, costoOra: val === '' ? '' : parseFloat(val) });
                                }}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Livello Skill</label>
                            <select
                                className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={form.skillLevel}
                                onChange={e => setForm({ ...form, skillLevel: e.target.value })}
                            >
                                <option value="JUNIOR">Junior</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="SENIOR">Senior</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo Contratto</label>
                            <select
                                className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Peso Produttività</label>
                            <select
                                className="w-full p-2 border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={form.productivityWeight}
                                onChange={e => setForm({ ...form, productivityWeight: parseFloat(e.target.value) })}
                            >
                                <option value={1.0}>100% (Standard)</option>
                                <option value={0.5}>50% (Metà)</option>
                                <option value={0.0}>0% (Escluso)</option>
                            </select>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Postazioni Abilitate</label>
                        <div className="flex flex-wrap gap-2 items-center">
                            {availableStations.map(p => (
                                <label key={p} className={`px-3 py-1 rounded-full border cursor-pointer text-sm transition ${form.postazioni.includes(p) ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-500/50 text-indigo-800 dark:text-indigo-300' : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300'
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
                                    className="border border-gray-200 dark:border-slate-600 rounded px-2 py-1 text-xs w-24 outline-indigo-500 bg-gray-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 dark:text-white transition"
                                    placeholder="Nuova..."
                                    value={newStation}
                                    onChange={e => setNewStation(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddStation(e); }}
                                />
                                <button onClick={handleAddStation} className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/70 transition" title="Aggiungi Postazione">
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
                ) : (
                    <div className="space-y-12">
                        {['MANAGER', 'SALA', 'CUCINA'].map(section => {
                            const sectionStaff = staff.filter(s => {
                                const r = (s.ruolo || '').toUpperCase();
                                if (section === 'MANAGER') return r === 'MANAGER' || r.includes('DIRETTORE') || r.includes('TITOLARE');
                                if (section === 'CUCINA') return r === 'CUCINA' || r.includes('CHEF') || r.includes('CUOCO') || r.includes('LAVAPIATTI');
                                return r === 'SALA' || (!r.includes('MANAGER') && !r.includes('DIRETTORE') && !r.includes('TITOLARE') && !r.includes('CUCINA') && !r.includes('CHEF') && !r.includes('CUOCO'));
                            });

                            if (sectionStaff.length === 0) return null;

                            return (
                                <div key={section} className="animate-in fade-in duration-500">
                                    <div className="flex items-center gap-3 mb-4">
                                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white border-l-4 border-indigo-500 pl-3">
                                            {section}
                                        </h2>
                                        <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                            {sectionStaff.length}
                                        </span>
                                    </div>

                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {sectionStaff.map(s => {
                                                const initials = `${s.nome[0] || ''}${s.cognome?.[0] || ''}`.toUpperCase();
                                                const skillColors: any = {
                                                    SENIOR: 'from-purple-500 to-purple-600',
                                                    MEDIUM: 'from-blue-500 to-blue-600',
                                                    JUNIOR: 'from-orange-500 to-orange-600'
                                                };
                                                const skillColor = skillColors[s.skillLevel || ''] || 'from-gray-500 to-gray-600';

                                                return (
                                                    <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md dark:hover:shadow-indigo-900/10 transition-all duration-200 overflow-hidden group">
                                                        {/* Header with Avatar */}
                                                        <div className="p-6 pb-4">
                                                            <div className="flex items-start gap-4">
                                                                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${skillColor} flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0`}>
                                                                    {initials}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                                                        {capitalizeName(s.nome)} {capitalizeName(s.cognome)}
                                                                    </h3>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold">
                                                                            {s.ruolo}
                                                                        </span>
                                                                        {s.productivityWeight !== undefined && s.productivityWeight !== 1.0 && (
                                                                            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs font-semibold border border-purple-200 dark:border-purple-800" title="Peso Produttività">
                                                                                {s.productivityWeight * 100}%
                                                                            </span>
                                                                        )}
                                                                        {s.skillLevel && (
                                                                            <span className="ml-2 text-yellow-500 font-bold" title={s.skillLevel}>
                                                                                {renderSkillLevel(s.skillLevel)}
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
                                                                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                    </svg>
                                                                    <span className="text-gray-600 dark:text-gray-300 truncate">{s.email}</span>
                                                                </div>
                                                            )}

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 group relative hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-slate-600 transition">
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex justify-between">
                                                                        Ore Contratto
                                                                        <Edit2 size={10} className="opacity-0 group-hover:opacity-50" />
                                                                    </div>
                                                                    <div className="flex items-center text-sm font-bold text-gray-900 dark:text-white gap-1">
                                                                        <input
                                                                            type="number"
                                                                            className="bg-transparent outline-none w-10 text-center border-b border-transparent hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 transition"
                                                                            defaultValue={s.oreMinime}
                                                                            onBlur={(e) => quickUpdateHours(s.id, parseInt(e.target.value) || 0, s.oreMassime)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                        />
                                                                        <span className="text-gray-400">-</span>
                                                                        <input
                                                                            type="number"
                                                                            className="bg-transparent outline-none w-10 text-center border-b border-transparent hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 transition"
                                                                            defaultValue={s.oreMassime}
                                                                            onBlur={(e) => quickUpdateHours(s.id, s.oreMinime, parseInt(e.target.value) || 0)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                        />
                                                                        <span className="text-gray-400 text-xs font-normal">h</span>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-3 cursor-text hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition relative group">
                                                                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 flex justify-between">
                                                                        Costo Orario
                                                                        <Edit2 size={10} className="opacity-0 group-hover:opacity-50" />
                                                                    </div>
                                                                    <div className="flex items-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                                                        <span className="mr-1">€</span>
                                                                        <input
                                                                            type="number"
                                                                            className="bg-transparent outline-none w-full"
                                                                            defaultValue={s.costoOra}
                                                                            onBlur={(e) => quickUpdateCost(s.id, parseFloat(e.target.value) || 0)}
                                                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {s.postazioni.length > -1 && (
                                                                <div>
                                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Postazioni</div>
                                                                    <div className="flex flex-wrap gap-1.5 items-center">
                                                                        {interactPostazioni(s.postazioni, (p) => quickUpdateStations(s.id, s.postazioni, p, 'remove'))}
                                                                        <div className="relative">
                                                                            <button className="p-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-gray-600 dark:text-gray-300 transition">
                                                                                <Plus size={12} />
                                                                            </button>
                                                                            <select
                                                                                className="absolute inset-0 opacity-0 cursor-pointer w-full bg-slate-800"
                                                                                value=""
                                                                                onChange={(e) => {
                                                                                    if (e.target.value) quickUpdateStations(s.id, s.postazioni, e.target.value, 'add');
                                                                                }}
                                                                            >
                                                                                <option value="">+</option>
                                                                                {availableStations.filter(as => !s.postazioni.includes(as)).sort().map(as => (
                                                                                    <option key={as} value={as}>{as}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Actions Footer */}
                                                        <div className="px-6 py-3 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-2">
                                                            <Link
                                                                href={`/staff/${s.id}/competenze`}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-md transition text-sm font-medium"
                                                                title="Valuta competenze"
                                                            >
                                                                <Star size={14} />
                                                                Valuta
                                                            </Link>
                                                            <button
                                                                onClick={() => startEdit(s)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition text-sm font-medium"
                                                                title="Modifica"
                                                            >
                                                                <Edit2 size={14} />
                                                                Modifica
                                                            </button>
                                                            <button
                                                                onClick={() => setManagingAvailability({ id: s.id, nome: `${s.nome} ${s.cognome}` })}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition text-sm font-medium"
                                                                title="Disponibilità"
                                                            >
                                                                <Clock size={14} />
                                                                Orari
                                                            </button>
                                                            <button
                                                                onClick={() => removeRow(s.id, s.nome)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition text-sm font-medium"
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
                                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                                                    <tr>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ruolo</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ore (Min-Max)</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Postazioni</th>
                                                        <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Azioni</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                                    {sectionStaff.map(s => (
                                                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
                                                            <td className="p-4 font-medium text-gray-900 dark:text-white">
                                                                {capitalizeName(s.nome)} {capitalizeName(s.cognome)}
                                                            </td>
                                                            <td className="p-4 text-gray-600 dark:text-gray-300">
                                                                <div className="flex flex-wrap gap-1">
                                                                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-xs font-semibold w-fit">{s.ruolo}</span>
                                                                    {s.productivityWeight !== undefined && s.productivityWeight !== 1.0 && (
                                                                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs font-semibold border border-purple-200 dark:border-purple-800 w-fit" title="Peso Produttività">
                                                                            {s.productivityWeight * 100}%
                                                                        </span>
                                                                    )}
                                                                    {s.skillLevel && (
                                                                        <span className="text-yellow-500 font-bold ml-1" title={s.skillLevel}>
                                                                            {renderSkillLevel(s.skillLevel)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">{s.email || '-'}</td>
                                                            <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">
                                                                <div className="flex items-center gap-1 group">
                                                                    <input
                                                                        type="number"
                                                                        className="bg-transparent outline-none w-8 text-center border-b border-transparent hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 transition"
                                                                        defaultValue={s.oreMinime}
                                                                        onBlur={(e) => quickUpdateHours(s.id, parseInt(e.target.value) || 0, s.oreMassime)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                    />
                                                                    <span>-</span>
                                                                    <input
                                                                        type="number"
                                                                        className="bg-transparent outline-none w-8 text-center border-b border-transparent hover:border-gray-300 dark:hover:border-slate-500 focus:border-indigo-500 transition"
                                                                        defaultValue={s.oreMassime}
                                                                        onBlur={(e) => quickUpdateHours(s.id, s.oreMinime, parseInt(e.target.value) || 0)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                    />
                                                                    <span className="opacity-0 group-hover:opacity-50 ml-1"><Edit2 size={10} /></span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-gray-600 dark:text-gray-400 text-sm w-32">
                                                                <div className="flex items-center bg-gray-50 dark:bg-slate-700/50 rounded px-2 py-1 w-full border border-transparent hover:border-gray-300 dark:hover:border-slate-600 transition">
                                                                    <span className="text-gray-400 mr-1">€</span>
                                                                    <input
                                                                        type="number"
                                                                        className="bg-transparent outline-none w-full font-medium text-gray-700 dark:text-gray-300"
                                                                        defaultValue={s.costoOra}
                                                                        onBlur={(e) => quickUpdateCost(s.id, parseFloat(e.target.value) || 0)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex flex-wrap gap-1 items-center">
                                                                    {interactPostazioni(s.postazioni, (p) => quickUpdateStations(s.id, s.postazioni, p, 'remove'))}
                                                                    <div className="relative inline-block align-middle">
                                                                        <button className="p-0.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded text-gray-600 dark:text-gray-400 transition">
                                                                            <Plus size={10} />
                                                                        </button>
                                                                        <select
                                                                            className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                                                            value=""
                                                                            onChange={(e) => {
                                                                                if (e.target.value) quickUpdateStations(s.id, s.postazioni, e.target.value, 'add');
                                                                            }}
                                                                        >
                                                                            <option value="">+</option>
                                                                            {availableStations.filter(as => !s.postazioni.includes(as)).sort().map(as => (
                                                                                <option key={as} value={as}>{as}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Link
                                                                        href={`/staff/${s.id}/competenze`}
                                                                        className="p-1.5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-md transition"
                                                                        title="Valuta competenze"
                                                                    >
                                                                        <Star size={16} />
                                                                    </Link>
                                                                    <button
                                                                        onClick={() => startEdit(s)}
                                                                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition"
                                                                        title="Modifica"
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setManagingAvailability({ id: s.id, nome: `${s.nome} ${s.cognome}` })}
                                                                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition"
                                                                        title="Disponibilità"
                                                                    >
                                                                        <Clock size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => removeRow(s.id, s.nome)}
                                                                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition"
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
                                    )}
                                </div>
                            );
                        })}
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
