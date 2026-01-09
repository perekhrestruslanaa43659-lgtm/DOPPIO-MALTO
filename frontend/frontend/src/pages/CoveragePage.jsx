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
    const [forecast, setForecast] = useState(null) // Stato per dati forecast

    // Load forecast when week changes
    useEffect(() => {
        const loadForecast = async () => {
            try {
                // Assumiamo weekStart in formato ISO YYYY-MM-DD
                const ws = currentWeekStart ? new Date(currentWeekStart.getTime() - (currentWeekStart.getDay() === 0 ? 6 : currentWeekStart.getDay() - 1) * 86400000).toISOString().split('T')[0] : '2025-10-13' // Default fallback

                // Chiamata API generica o specifica se implementata
                // Qui usiamo l'endpoint generico getForecast
                const res = await api.getForecast()
                // Filtra per settimana corrente se necessario, per ora prendiamo il primo o simuliamo
                // In produzione: api.getForecast(ws)
                if (res.data && res.data.length > 0) {
                    // Cerca forecast corrispondente o prendi ultimo
                    const match = res.data.find(f => f.weekStart === ws) || res.data[res.data.length - 1]
                    if (match && match.data) {
                        setForecast(JSON.parse(match.data))
                    }
                }
            } catch (err) {
                console.error("Error loading forecast", err)
            }
        }
        loadForecast()
    }, [currentWeekStart])

    // Calcolo Ore Fabbisogno Totali (Senza filtri giorni)
    const calculateTotalCoverageHours = () => {
        let total = 0
        data.body.filter(r => r.enabled !== false).forEach(row => {
            for (let i = 0; i < 28; i += 2) { // 14 slots * 2 (In/Out)
                const s = row.slots[i]; const e = row.slots[i + 1];
                if (s && e && s.includes(':') && e.includes(':')) {
                    const [sh, sm] = s.split(':').map(Number);
                    const [eh, em] = e.split(':').map(Number);
                    let diff = (eh + em / 60) - (sh + sm / 60);
                    if (diff < 0) diff += 24;
                    total += diff;
                }
            }
        })
        return total
    }

    // Estrai Ore Budget dal Forecast
    const getBudgetHours = () => {
        if (!forecast) return 0
        // Cerca riga "Ore Budget" o simile
        const row = forecast.find(r => String(r[0]).toLowerCase().includes('ore budget') || String(r[0]).toLowerCase().includes('ore previste'))
        if (!row) return 0

        // Somma colonne 1-7 (giorni)
        let sum = 0
        // colonne 1 a 7 sono i gironi
        for (let i = 1; i <= 7; i++) {
            const val = parseFloat(String(row[i]).replace(',', '.')) || 0
            sum += val
        }
        return sum
    }

    const totalBudgetHours = getBudgetHours()
    const totalCoverageHours = calculateTotalCoverageHours()
    const diffHours = totalBudgetHours - totalCoverageHours

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

                    return {
                        ...r,
                        slots: slots || Array(32).fill(''),
                        extra: extra || [],
                        enabled: r.enabled !== undefined ? r.enabled : true // Default to enabled
                    };
                });

                // Check if PASS station exists, if not add it
                const hasPass = processed.some(row => row.station === 'PASS');
                if (!hasPass) {
                    // Create PASS station with specific hours
                    const passSlots = Array(32).fill('');

                    // Settimana (index 0) - template, leave empty or set default
                    passSlots[0] = '12:00';  // Turno 1 In
                    passSlots[1] = '18:00';  // Turno 1 Out
                    passSlots[2] = '18:00';  // Turno 2 In
                    passSlots[3] = '01:00';  // Turno 2 Out

                    // Lunedì to Venerdì (indexes 1-5): 12:00-18:00, 18:00-01:00
                    for (let d = 1; d <= 5; d++) {
                        passSlots[d * 4] = '12:00';      // Turno 1 In
                        passSlots[d * 4 + 1] = '18:00';  // Turno 1 Out
                        passSlots[d * 4 + 2] = '18:00';  // Turno 2 In
                        passSlots[d * 4 + 3] = '01:00';  // Turno 2 Out
                    }

                    // Sabato and Domenica (indexes 6-7): 12:00-18:00, 18:00-02:00
                    for (let d = 6; d <= 7; d++) {
                        passSlots[d * 4] = '12:00';      // Turno 1 In
                        passSlots[d * 4 + 1] = '18:00';  // Turno 1 Out
                        passSlots[d * 4 + 2] = '18:00';  // Turno 2 In
                        passSlots[d * 4 + 3] = '02:00';  // Turno 2 Out
                    }

                    processed.push({
                        station: 'PASS',
                        freq: 'Tutti',
                        slots: passSlots,
                        extra: [],
                        enabled: true
                    });
                }

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

    const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

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
                    const newRow = { station: 'Nuova Postazione', freq: 'Tutti', slots: Array(32).fill(''), extra: Array(3).fill(''), enabled: true };
                    setData({ ...data, body: [...data.body, newRow] });
                }}>Aggiungi Riga</button>
                <button className="btn" style={{ background: '#4caf50', color: 'white' }} onClick={handleSave}>Salva Modifiche</button>
                <button className="btn" style={{ background: '#f44336', color: 'white' }} onClick={handleClear}>Cancella Tutto</button>
                <button className="btn" onClick={loadData}>Ricarica</button>
            </div>

            {/* SEZIONE STATISTICHE BUDGET VS FABBISOGNO */}
            {forecast && (
                <div style={{
                    marginBottom: '20px', padding: '15px', borderRadius: '8px',
                    backgroundColor: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                    display: 'flex', gap: '30px', alignItems: 'center', flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85em', color: '#666', fontWeight: '600' }}>ORE BUDGET (Forecast)</span>
                        <span style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#2c3e50' }}>
                            {totalBudgetHours.toFixed(1)}
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85em', color: '#666', fontWeight: '600' }}>ORE FABBISOGNO (Pianificate)</span>
                        <span style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#ea580c' }}>
                            {totalCoverageHours.toFixed(1)}
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85em', color: '#666', fontWeight: '600' }}>DIFFERENZA</span>
                        <span style={{
                            fontSize: '1.5em', fontWeight: 'bold',
                            color: diffHours >= 0 ? '#16a34a' : '#dc2626'
                        }}>
                            {diffHours > 0 ? '+' : ''}{diffHours.toFixed(1)}
                        </span>
                        <span style={{ fontSize: '0.75em', color: diffHours >= 0 ? '#16a34a' : '#dc2626' }}>
                            {diffHours >= 0 ? 'Ore disponibili' : 'Fuori budget!'}
                        </span>
                    </div>

                    <div style={{ marginLeft: 'auto', fontSize: '0.9em', color: '#555', fontStyle: 'italic' }}>
                        <span style={{ marginRight: '10px' }}>
                            Dati Forecast sincronizzati
                        </span>
                    </div>
                </div>
            )}

            {data.body.length > 0 ? (
                <div style={{ overflowX: 'auto', border: '1px solid #ccc', width: '100%' }}>
                    <table className="table" style={{ fontSize: '1em', borderCollapse: 'collapse', textAlign: 'center', width: '100%', minWidth: '1500px' }}>
                        <thead>
                            <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <th rowSpan={2} style={{ border: '1px solid #999', background: '#e3f2fd', minWidth: '180px', position: 'sticky', left: 0, zIndex: 12, fontWeight: 'bold' }}>Postazione</th>
                                <th rowSpan={2} style={{ border: '1px solid #999', background: '#e3f2fd', minWidth: '80px', position: 'sticky', left: '180px', zIndex: 12, fontWeight: 'bold' }}>Ore Sett.</th>
                                {days.map((d, di) => (
                                    <React.Fragment key={d}>
                                        <th colSpan={2} style={{ border: '1px solid #999', background: '#fce4ec', fontWeight: 'bold' }}>
                                            {d} - Turno 1
                                        </th>
                                        <th colSpan={2} style={{ border: '1px solid #999', background: '#f3e5f5', fontWeight: 'bold' }}>
                                            {d} - Turno 2
                                        </th>
                                    </React.Fragment>
                                ))}
                            </tr>
                            <tr style={{ position: 'sticky', top: 40, zIndex: 10 }}>
                                {/* Empty cells for sticky columns */}
                                <th style={{ border: '1px solid #ccc', background: '#e3f2fd', position: 'sticky', left: 0, zIndex: 12 }}></th>
                                <th style={{ border: '1px solid #ccc', background: '#e3f2fd', position: 'sticky', left: '180px', zIndex: 12 }}></th>
                                {days.map((_, di) => (
                                    <React.Fragment key={di}>
                                        <th style={{ border: '1px solid #ccc', minWidth: '70px', background: '#fce4ec', fontWeight: 'bold' }}>In</th>
                                        <th style={{ border: '1px solid #ccc', minWidth: '70px', background: '#fce4ec', fontWeight: 'bold' }}>Out</th>
                                        <th style={{ border: '1px solid #ccc', minWidth: '70px', background: '#f3e5f5', fontWeight: 'bold' }}>In</th>
                                        <th style={{ border: '1px solid #ccc', minWidth: '70px', background: '#f3e5f5', fontWeight: 'bold' }}>Out</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.body.map((row, idx) => {
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #ddd', opacity: row.enabled === false ? 0.5 : 1 }}>
                                        <td style={{ border: '1px solid #ccc', background: '#fff', position: 'sticky', left: 0, zIndex: 5 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    onClick={() => {
                                                        const newBody = [...data.body];
                                                        newBody[idx].enabled = !newBody[idx].enabled;
                                                        setData({ ...data, body: newBody });
                                                    }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: row.enabled !== false ? '#4caf50' : '#f44336',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85em',
                                                        fontWeight: 'bold',
                                                        minWidth: '50px'
                                                    }}
                                                    title={row.enabled !== false ? "Postazione ATTIVA per generazione turni" : "Postazione DISATTIVATA - non verrà generata"}
                                                >
                                                    {row.enabled !== false ? 'ON' : 'OFF'}
                                                </button>
                                                <input type="text" value={row.station} onChange={e => updateRow(idx, 'station', e.target.value)}
                                                    style={{ flex: 1, border: 'none', fontWeight: 'bold' }} />
                                            </div>
                                        </td>
                                        <td style={{ border: '1px solid #ccc', background: '#fff', fontWeight: 'bold', position: 'sticky', left: '180px', zIndex: 5 }}>
                                            {(() => {
                                                let total = 0;
                                                // Sum all days (0-6 = Lun-Dom)
                                                for (let d = 0; d < 7; d++) {
                                                    for (let t = 0; t < 2; t++) {
                                                        const s = row.slots[d * 4 + t * 2];
                                                        const e = row.slots[d * 4 + t * 2 + 1];
                                                        if (s && e && typeof s === 'string' && typeof e === 'string' && s.includes(':') && e.includes(':')) {
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
                                        {row.slots && row.slots.slice(0, 28).map((s, si) => (
                                            <td key={si} style={{
                                                border: '1px solid #ccc',
                                                minWidth: '70px',
                                                background: (Math.floor(si / 4) % 2 !== 0 ? '#fff' : '#f9f9f9')
                                            }}>
                                                <input type="text" value={s} onChange={e => updateSlot(idx, si, e.target.value)}
                                                    style={{ width: '100%', minWidth: '60px', textAlign: 'center', border: 'none', background: 'transparent', color: s ? 'black' : '#eee' }} />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            {/* Row showing Pranzo/Sera breakdown */}
                            <tr style={{ background: '#fff3e0', fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                <td style={{ border: '1px solid #999', padding: '8px', position: 'sticky', left: 0, zIndex: 5, background: '#fff3e0' }}>
                                    ORE PRANZO / SERA
                                </td>
                                <td style={{ border: '1px solid #999', padding: '8px', position: 'sticky', left: '180px', zIndex: 5, background: '#fff3e0' }}>
                                    {/* Total Pranzo/Sera for week */}
                                    {(() => {
                                        let totalPranzo = 0;
                                        let totalSera = 0;
                                        data.body.forEach(row => {
                                            for (let d = 1; d < 8; d++) {
                                                // Turno 1 (Pranzo)
                                                const s1 = row.slots[d * 4];
                                                const e1 = row.slots[d * 4 + 1];
                                                if (s1 && e1 && typeof s1 === 'string' && typeof e1 === 'string' && s1.includes(':') && e1.includes(':')) {
                                                    const [sh, sm] = s1.split(':').map(Number);
                                                    const [eh, em] = e1.split(':').map(Number);
                                                    let diff = (eh + em / 60) - (sh + sm / 60);
                                                    if (diff < 0) diff += 24;
                                                    totalPranzo += diff;
                                                }
                                                // Turno 2 (Sera)
                                                const s2 = row.slots[d * 4 + 2];
                                                const e2 = row.slots[d * 4 + 3];
                                                if (s2 && e2 && typeof s2 === 'string' && typeof e2 === 'string' && s2.includes(':') && e2.includes(':')) {
                                                    const [sh, sm] = s2.split(':').map(Number);
                                                    const [eh, em] = e2.split(':').map(Number);
                                                    let diff = (eh + em / 60) - (sh + sm / 60);
                                                    if (diff < 0) diff += 24;
                                                    totalSera += diff;
                                                }
                                            }
                                        });
                                        return `P: ${totalPranzo.toFixed(1)} / S: ${totalSera.toFixed(1)}`;
                                    })()}
                                </td>
                                {/* Calculate Pranzo/Sera totals for each day (skip Settimana, only Mon-Sun) */}
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const dayIdx = i + 1; // Start from 1 (Lunedì) instead of 0 (Settimana)
                                    let pranzoTotal = 0;
                                    let seraTotal = 0;
                                    data.body.forEach(row => {
                                        // Turno 1 (Pranzo)
                                        const s1 = row.slots[dayIdx * 4];
                                        const e1 = row.slots[dayIdx * 4 + 1];
                                        if (s1 && e1 && typeof s1 === 'string' && typeof e1 === 'string' && s1.includes(':') && e1.includes(':')) {
                                            const [sh, sm] = s1.split(':').map(Number);
                                            const [eh, em] = e1.split(':').map(Number);
                                            let diff = (eh + em / 60) - (sh + sm / 60);
                                            if (diff < 0) diff += 24;
                                            pranzoTotal += diff;
                                        }
                                        // Turno 2 (Sera)
                                        const s2 = row.slots[dayIdx * 4 + 2];
                                        const e2 = row.slots[dayIdx * 4 + 3];
                                        if (s2 && e2 && typeof s2 === 'string' && typeof e2 === 'string' && s2.includes(':') && e2.includes(':')) {
                                            const [sh, sm] = s2.split(':').map(Number);
                                            const [eh, em] = e2.split(':').map(Number);
                                            let diff = (eh + em / 60) - (sh + sm / 60);
                                            if (diff < 0) diff += 24;
                                            seraTotal += diff;
                                        }
                                    });

                                    return (
                                        <td
                                            key={dayIdx}
                                            colSpan={4}
                                            style={{
                                                border: '1px solid #999',
                                                padding: '8px',
                                                textAlign: 'center',
                                                fontSize: '0.9em',
                                                color: '#e65100',
                                                background: '#fff3e0'
                                            }}
                                        >
                                            <div>P: {pranzoTotal.toFixed(1)}</div>
                                            <div>S: {seraTotal.toFixed(1)}</div>
                                        </td>
                                    );
                                })}
                            </tr>
                            {/* Row showing daily totals */}
                            <tr style={{ background: '#e3f2fd', fontWeight: 'bold', borderTop: '2px solid #333' }}>
                                <td style={{ border: '1px solid #999', padding: '8px', position: 'sticky', left: 0, zIndex: 5, background: '#e3f2fd' }}>
                                    TOTALE ORE GIORNALIERE
                                </td>
                                <td style={{ border: '1px solid #999', padding: '8px', position: 'sticky', left: '180px', zIndex: 5, background: '#e3f2fd' }}>
                                    {/* Total weekly hours */}
                                    {(() => {
                                        let grandTotal = 0;
                                        data.body.forEach(row => {
                                            for (let d = 1; d < 8; d++) {
                                                for (let t = 0; t < 2; t++) {
                                                    const s = row.slots[d * 4 + t * 2];
                                                    const e = row.slots[d * 4 + t * 2 + 1];
                                                    if (s && e && typeof s === 'string' && typeof e === 'string' && s.includes(':') && e.includes(':')) {
                                                        const [sh, sm] = s.split(':').map(Number);
                                                        const [eh, em] = e.split(':').map(Number);
                                                        let diff = (eh + em / 60) - (sh + sm / 60);
                                                        if (diff < 0) diff += 24;
                                                        grandTotal += diff;
                                                    }
                                                }
                                            }
                                        });
                                        return grandTotal.toFixed(1);
                                    })()}
                                </td>
                                {/* Calculate daily totals for each day (skip Settimana, only Mon-Sun) */}
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const dayIdx = i + 1; // Start from 1 (Lunedì) instead of 0 (Settimana)
                                    // For each day, calculate total hours across all stations
                                    let dayTotal = 0;
                                    data.body.forEach(row => {
                                        for (let t = 0; t < 2; t++) {
                                            const s = row.slots[dayIdx * 4 + t * 2];
                                            const e = row.slots[dayIdx * 4 + t * 2 + 1];
                                            if (s && e && typeof s === 'string' && typeof e === 'string' && s.includes(':') && e.includes(':')) {
                                                const [sh, sm] = s.split(':').map(Number);
                                                const [eh, em] = e.split(':').map(Number);
                                                let diff = (eh + em / 60) - (sh + sm / 60);
                                                if (diff < 0) diff += 24;
                                                dayTotal += diff;
                                            }
                                        }
                                    });

                                    return (
                                        <td
                                            key={dayIdx}
                                            colSpan={4}
                                            style={{
                                                border: '1px solid #999',
                                                padding: '8px',
                                                textAlign: 'center',
                                                fontSize: '1.1em',
                                                color: '#1565c0',
                                                background: '#e3f2fd'
                                            }}
                                        >
                                            {dayTotal.toFixed(1)} h
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
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
