
import React, { useState, useEffect } from 'react'
import api from '../util/api'
import QuarterTimeInput from '../components/QuarterTimeInput'

export default function FixedShiftsPage() {
    const [staff, setStaff] = useState([])
    const [templates, setTemplates] = useState([])
    const [recurringShifts, setRecurringShifts] = useState([])
    const days = [
        { label: 'Lunedì', value: 1 },
        { label: 'Martedì', value: 2 },
        { label: 'Mercoledì', value: 3 },
        { label: 'Giovedì', value: 4 },
        { label: 'Venerdì', value: 5 },
        { label: 'Sabato', value: 6 },
        { label: 'Domenica', value: 0 }
    ]

    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        console.log("Loading data for FixedShiftsPage...")
        try {
            const s = await api.getStaff()
            console.log("Final Staff Loaded:", s.length)
            setStaff(s)

            const t = await api.getShiftTemplates()
            console.log("Templates Loaded:", t.length)
            setTemplates(t)

            const r = await api.getRecurringShifts()
            console.log("Recurring Loaded:", r.length)
            setRecurringShifts(r)
        } catch (e) {
            console.error("LOAD ERROR:", e)
            alert("Errore caricamento: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    const [modalData, setModalData] = useState(null) // { staffId, dayOfWeek }

    const handleDelete = async (id) => {
        if (!confirm("Rimuovere questo turno fisso?")) return
        try {
            await api.deleteRecurringShift(id)
            loadData()
        } catch (e) {
            alert(e.message)
        }
    }

    const [form, setForm] = useState({
        staffId: '',
        dayOfWeek: 1,
        shiftTemplateId: '',
        start_time: '',
        end_time: '',
        postazione: ''
    })

    const handleAdd = async (e) => {
        e.preventDefault()
        try {
            await api.addRecurringShift(form)
            setForm({ ...form, start_time: '', end_time: '', postazione: '' }) // Reset partially
            loadData()
        } catch (e) {
            alert(e.message)
        }
    }

    if (loading) return <div className="panel">Caricamento...</div>

    return (
        <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Gestione Orari Fissi (Ricorrenti) ({staff.length} dipendenti)</h2>
                <button className="btn" onClick={loadData}>🔄 Aggiorna</button>
            </div>

            <p style={{ color: '#666', marginBottom: '20px' }}>
                Questi turni verranno applicati automaticamente ogni settimana durante la generazione automatica.
            </p>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
                <h4 style={{ marginTop: 0 }}>Aggiungi Turno Fisso</h4>
                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '5px' }}>Staff</label>
                        <select className="input" value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })} required>
                            <option value="">Seleziona Staff...</option>
                            {staff.map(s => <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '5px' }}>Giorno</label>
                        <select className="input" value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })} required>
                            {days.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '5px' }}>Template (Opzionale)</label>
                        <select className="input" value={form.shiftTemplateId} onChange={e => setForm({ ...form, shiftTemplateId: e.target.value })}>
                            <option value="">Nessuno (Orario Manuale)</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.oraInizio}-{t.oraFine})</option>)}
                        </select>
                    </div>
                    {!form.shiftTemplateId && (
                        <>
                            <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '5px' }}>
                                <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '5px', fontWeight: 'bold' }}>Inizio</label>
                                <QuarterTimeInput value={form.start_time} onChange={v => setForm({ ...form, start_time: v })} />
                            </div>
                            <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '5px' }}>
                                <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '5px', fontWeight: 'bold' }}>Fine</label>
                                <QuarterTimeInput value={form.end_time} onChange={v => setForm({ ...form, end_time: v })} />
                            </div>
                            <div style={{ width: '120px' }}>
                                <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '5px' }}>Postazione</label>
                                <input type="text" className="input" value={form.postazione} onChange={e => setForm({ ...form, postazione: e.target.value })} placeholder="Es. BAR" />
                            </div>
                        </>
                    )}
                    <button type="submit" className="btn" style={{ background: '#28a745', color: 'white' }}>➕ Aggiungi</button>
                </form>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Staff</th>
                            <th>Giorno</th>
                            <th>Turno / Orario</th>
                            <th>Postazione</th>
                            <th style={{ width: '100px' }}>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recurringShifts.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>Nessun turno fisso configurato.</td></tr>}
                        {recurringShifts.sort((a, b) => (a.staff.nome.localeCompare(b.staff.nome)) || (a.dayOfWeek - b.dayOfWeek)).map(r => {
                            const day = days.find(d => d.value === r.dayOfWeek);
                            return (
                                <tr key={r.id}>
                                    <td style={{ fontWeight: 'bold' }}>{r.staff.nome} {r.staff.cognome}</td>
                                    <td>{day ? day.label : r.dayOfWeek}</td>
                                    <td>
                                        {r.shiftTemplate ? (
                                            <span className="badge" style={{ background: '#e3f2fd', color: '#0d47a1' }}>{r.shiftTemplate.nome} ({r.shiftTemplate.oraInizio}-{r.shiftTemplate.oraFine})</span>
                                        ) : (
                                            `${r.start_time} - ${r.end_time}`
                                        )}
                                    </td>
                                    <td>{r.postazione || (r.shiftTemplate?.nome) || '-'}</td>
                                    <td>
                                        <button className="btn" style={{ background: '#f8d7da', color: '#721c24', padding: '5px 10px' }} onClick={() => handleDelete(r.id)}>Elimina</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
