import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import api from '../util/api'

// Helper for picking days
const DayPicker = ({ value, onChange }) => {
    const [open, setOpen] = useState(false)
    const options = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

    // Normalize and clean value on render
    const cleanValue = (val) => {
        if (!val) return []
        // Fix encoding issues common in CSV imports
        let s = String(val).replace(/Ã¬/g, 'ì').replace(/VenerdÃ/g, 'Venerdì');
        // Split and filter
        return s.split(',').map(x => x.trim()).filter(x => options.includes(x))
    }

    // Current state derived from props
    let selected = cleanValue(value)

    // Handle "Tutti" special case from legacy data or CSV
    if (String(value).toLowerCase() === 'tutti') {
        selected = [...options]
    }

    const isAll = selected.length === 7 && options.every(o => selected.includes(o))

    const toggleDay = (day) => {
        let newSel = [...selected]
        if (newSel.includes(day)) {
            newSel = newSel.filter(d => d !== day)
        } else {
            newSel.push(day)
        }
        // Always sort
        newSel.sort((a, b) => options.indexOf(a) - options.indexOf(b))

        // If all selected, saving as "Tutti" might be cleaner for UI, but user asked for "solo giorni".
        // Let's save as list of days to be safe and explicit, or "Tutti" if they embrace it.
        // User said "devono essere solo i giorni", so maybe explicit list is better? 
        // But "Tutti" is concise. Let's return the comma separated string.
        if (newSel.length === 7) onChange("Tutti")
        else onChange(newSel.join(', '))
    }

    const toggleAll = () => {
        if (isAll) onChange('')
        else onChange('Tutti')
    }

    return (
        <div style={{ position: 'relative' }}>
            <div
                onClick={() => setOpen(!open)}
                style={{
                    padding: '5px', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '3px',
                    minHeight: '20px', fontSize: '0.8em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    fontWeight: isAll ? 'bold' : 'normal', color: isAll ? 'green' : 'black'
                }}
                title={value}
            >
                {isAll ? 'Tutti (Lun-Dom)' : (selected.join(', ') || 'Seleziona...')}
            </div>
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 1000,
                    background: 'white', border: '1px solid #ccc', padding: '10px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)', width: '180px', textAlign: 'left'
                }}>
                    <div
                        style={{ padding: '5px', cursor: 'pointer', fontWeight: 'bold', borderBottom: '1px solid #eee', marginBottom: '5px' }}
                        onClick={toggleAll}
                    >
                        {isAll ? 'Deseleziona Tutti' : 'Seleziona Tutti'}
                    </div>
                    {options.map(day => (
                        <div key={day} style={{ padding: '3px 5px', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="checkbox"
                                checked={selected.includes(day)}
                                onChange={() => toggleDay(day)}
                                style={{ marginRight: '8px', cursor: 'pointer' }}
                            />
                            <span onClick={() => toggleDay(day)} style={{ cursor: 'pointer', flex: 1 }}>{day}</span>
                        </div>
                    ))}
                    <div
                        style={{ marginTop: '10px', padding: '5px', textAlign: 'center', background: '#f5f5f5', cursor: 'pointer', borderRadius: '3px', border: '1px solid #ddd' }}
                        onClick={() => setOpen(false)}
                    >
                        Chiudi
                    </div>
                </div>
            )}
            {open && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setOpen(false)} />}
        </div>
    )
}

export default function CoveragePage() {
    const [data, setData] = useState({ headers: {}, body: [] })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const rows = await api.getCoverage()
            if (rows && rows.length > 0) {
                const processed = rows.map(r => {
                    let slots = r.slots;
                    if (slots && !Array.isArray(slots) && typeof slots === 'object') {
                        // CONVERT Object { Lun: ["10:00-15:00"], ... } -> Array(32)
                        const newSlots = Array(32).fill('');
                        const daysMap = { 'Lun': 1, 'Mar': 2, 'Mer': 3, 'Gio': 4, 'Ven': 5, 'Sab': 6, 'Dom': 7 };

                        Object.keys(slots).forEach(k => {
                            const dIndex = daysMap[k];
                            if (dIndex !== undefined) {
                                const shifts = slots[k] || [];
                                // Shift 1
                                if (shifts[0]) {
                                    const [s, e] = shifts[0].split('-');
                                    newSlots[dIndex * 4] = s || '';
                                    newSlots[dIndex * 4 + 1] = e || '';
                                }
                                // Shift 2
                                if (shifts[1]) {
                                    const [s, e] = shifts[1].split('-');
                                    newSlots[dIndex * 4 + 2] = s || '';
                                    newSlots[dIndex * 4 + 3] = e || '';
                                }
                            }
                        });
                        slots = newSlots;
                    }

                    let extra = r.extra;
                    if (!Array.isArray(extra)) {
                        if (extra && typeof extra === 'object') {
                            // If object (e.g. from JSON), try to convert to array
                            extra = Object.values(extra);
                        } else {
                            extra = [];
                        }
                    }

                    return { ...r, slots: slots || Array(32).fill(''), extra: extra || [] };
                });

                setData({
                    headers: null,
                    body: processed
                })
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleImport = (e) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

            const bodyRows = rows.slice(4).filter(r => r && r.length > 0 && r[0])
            const parsedBody = bodyRows.map((r, idx) => {
                const station = r[0] || ''
                const freq = r[1] || ''
                const slots = Array(32).fill('')

                // Map all 8 blocks (Settimana + 7 days) 1:1
                // CSV grid starts at index 2. UI grid starts at index 0.
                for (let b = 0; b < 8; b++) {
                    const csvBase = 2 + b * 4
                    const uiBase = b * 4
                    for (let s = 0; s < 4; s++) {
                        slots[uiBase + s] = r[csvBase + s] || ''
                    }
                }

                const extra = r.slice(34).map(x => x || '')
                return {
                    id: idx + 1000,
                    station,
                    freq,
                    frequency: freq, // DB field map
                    slots,
                    extra,
                    weekStart: "2025-10-13"
                }
            })

            const newData = { headers: {}, body: parsedBody }
            setData(newData)

            if (confirm("Importazione riuscita. Vuoi salvare questi dati come Fabbisogni Ufficiali?")) {
                await api.saveCoverage(parsedBody)
            }
        }
        reader.readAsBinaryString(file)
    }

    const handleSave = async () => {
        try {
            await api.saveCoverage(data.body)
            alert("Salvataggio riuscito!")
            loadData() // Reload to get IDs if needed
        } catch (e) {
            alert("Errore salvataggio: " + e.message)
        }
    }

    // Edit Handlers
    const updateRow = (idx, field, val) => {
        const newBody = [...data.body]
        newBody[idx][field] = val
        // Sync 'freq' and 'frequency' just in case
        if (field === 'station') newBody[idx].station = val
        if (field === 'frequency') { newBody[idx].freq = val; newBody[idx].frequency = val; }

        setData({ ...data, body: newBody })
    }

    const updateSlot = (rowIdx, slotIdx, val) => {
        const newBody = [...data.body]
        const newSlots = [...newBody[rowIdx].slots]
        newSlots[slotIdx] = val

        // AUTO-SYNC: If editing "Settimana" (index 0-3), copy to all other days (blocks 1 to 7)
        if (slotIdx < 4) {
            for (let d = 1; d < 8; d++) {
                newSlots[d * 4 + (slotIdx % 4)] = val
            }
        }

        newBody[rowIdx].slots = newSlots
        setData({ ...data, body: newBody })
    }

    const updateExtra = (rowIdx, extraIdx, val) => {
        const newBody = [...data.body]
        const newExtra = [...newBody[rowIdx].extra]
        newExtra[extraIdx] = val
        newBody[rowIdx].extra = newExtra
        setData({ ...data, body: newBody })
    }

    const days = ['Settimana', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

    const handleClear = async () => {
        if (confirm("ATTENZIONE: Stai per cancellare DEFINITIVAMENTE la tabella dei fabbisogni dal database.\n\nQuesta azione NON è reversibile. Vuoi procedere?")) {
            if (confirm("Sei proprio sicuro? La tabella scomparirà.")) {
                try {
                    // We can implement a clean endpoint or just save empty array.
                    // Saving empty array clears the table in our current backend implementation.
                    await api.saveCoverage([])
                    setData({ headers: null, body: [] })
                    alert("Tabella cancellata.")
                } catch (e) {
                    alert("Errore: " + e.message)
                }
            }
        }
    }

    return (
        <div style={{ padding: '20px', overflowX: 'auto' }}>
            <h2>Fabbisogno / Turni da Coprire</h2>
            <div style={{ padding: '10px', background: '#e3f2fd', marginBottom: '10px', borderRadius: '5px', fontSize: '0.9em' }}>
                <strong style={{ color: '#1565c0' }}>NOTA:</strong> I dati caricati in questa tabella sono <strong>persistenti</strong> e visibili nella Dashboard.
                Non verranno persi a meno che tu non prema "Cancella Tutto" o carichi un nuovo file.
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <label className="btn" style={{ background: '#e91e63', color: 'white' }}>
                    Importa CSV
                    <input type="file" style={{ display: 'none' }} onChange={handleImport} accept=".csv, .xlsx" />
                </label>
                <button className="btn" style={{ background: '#2196f3', color: 'white' }} onClick={() => {
                    const newRow = { station: 'Nuova Postazione', freq: 'Tutti', slots: Array(32).fill(''), extra: Array(3).fill('') };
                    setData({ ...data, body: [...data.body, newRow] });
                }}>Aggiungi Riga</button>
                <button className="btn" style={{ background: '#4caf50', color: 'white' }} onClick={handleSave}>Salva Modifiche</button>
                <button className="btn" style={{ background: '#f44336', color: 'white' }} onClick={handleClear}>Cancella Tutto</button>
                <button className="btn" onClick={loadData}>Ricarica</button>
            </div>

            {data.body.length > 0 ? (
                <div style={{ overflowX: 'auto', border: '1px solid #ccc', width: '100%' }}>
                    <table className="table" style={{ fontSize: '1em', borderCollapse: 'collapse', textAlign: 'center', width: '100%', minWidth: '1500px' }}>
                        <thead>
                            <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <th rowSpan={3} style={{ border: '1px solid #999', background: '#fff', minWidth: '250px' }}>Postazione</th>
                                <th rowSpan={3} style={{ border: '1px solid #999', background: '#fff', minWidth: '100px' }}>Ore Sett.</th>
                                {days.map((d, di) => (
                                    <th key={d} colSpan={4} style={{ border: '1px solid #999', background: di === 0 ? '#fff9c4' : '#e3f2fd' }}>{d}</th>
                                ))}
                            </tr>
                            <tr style={{ position: 'sticky', top: 30, zIndex: 10 }}>
                                {days.map((_, i) => (
                                    <React.Fragment key={i}>
                                        <th colSpan={2} style={{ border: '1px solid #ccc', background: '#fce4ec' }}>Turno 1</th>
                                        <th colSpan={2} style={{ border: '1px solid #ccc', background: '#f3e5f5' }}>Turno 2</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                            <tr style={{ position: 'sticky', top: 60, zIndex: 10 }}>
                                {Array.from({ length: 16 }).map((_, i) => (
                                    <React.Fragment key={i}>
                                        <th style={{ border: '1px solid #ccc', minWidth: '100px', background: '#fafafa' }}>In</th>
                                        <th style={{ border: '1px solid #ccc', minWidth: '100px', background: '#fafafa' }}>Out</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.body.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                                    <td style={{ border: '1px solid #ccc', background: '#fff' }}>
                                        <input type="text" value={row.station} onChange={e => updateRow(idx, 'station', e.target.value)}
                                            style={{ width: '100%', border: 'none', fontWeight: 'bold' }} />
                                    </td>
                                    <td style={{ border: '1px solid #ccc', background: '#fff', fontWeight: 'bold' }}>
                                        {(() => {
                                            let total = 0;
                                            // Calculation skip Settimana (index 0), only sum days 1-7
                                            for (let d = 1; d < 8; d++) {
                                                for (let t = 0; t < 2; t++) {
                                                    const s = row.slots[d * 4 + t * 2];
                                                    const e = row.slots[d * 4 + t * 2 + 1];
                                                    if (s && e && s.includes(':') && e.includes(':')) {
                                                        const [sh, sm] = s.split(':').map(Number);
                                                        const [eh, em] = e.split(':').map(Number);
                                                        let diff = (eh + em / 60) - (sh + sm / 60);
                                                        if (diff < 0) diff += 24;
                                                        total += diff;
                                                    }
                                                }
                                            }
                                            return total.toFixed(1);
                                        })()}
                                    </td>
                                    {row.slots && row.slots.map((s, si) => (
                                        <td key={si} style={{
                                            border: '1px solid #ccc',
                                            minWidth: '100px',
                                            background: (si < 4 ? '#fffde7' : (Math.floor(si / 4) % 2 !== 0 ? '#fff' : '#f9f9f9'))
                                        }}>
                                            <input type="text" value={s} onChange={e => updateSlot(idx, si, e.target.value)}
                                                style={{ width: '100%', minWidth: '80px', textAlign: 'center', border: 'none', background: 'transparent', color: s ? 'black' : '#eee' }} />
                                        </td>
                                    ))}

                                    {row.extra && row.extra.map((e, ei) => (
                                        <td key={ei} style={{ border: '1px solid #ccc' }}>
                                            <input type="text" value={e} onChange={e => updateExtra(idx, ei, e.target.value)}
                                                style={{ width: '100%', border: 'none', color: '#666' }} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999', border: '2px dashed #ccc' }}>
                    Nessun dato. Importa il CSV o aggiungi una riga manualmente.
                </div>
            )}
        </div>
    )
}
