import React, { useState, useEffect } from 'react'
import api from '../util/api'
import * as XLSX from 'xlsx'

// Helper to get dates
function getDatesInRange(startDate, endDate) {
    const dates = []
    let curr = new Date(startDate)
    const end = new Date(endDate)
    while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0])
        curr.setDate(curr.getDate() + 1)
    }
    return dates
}

// Helper: Get Range from Week Number (ISO) - STRICT MONDAY START
function getWeekRange(w, year = 2025) {
    const d = new Date(Date.UTC(year, 0, 4)); // Jan 4th is always in Week 1
    const day = d.getUTCDay() || 7;
    const startOfYear = new Date(d);
    startOfYear.setUTCDate(d.getUTCDate() - day + 1);

    const startD = new Date(startOfYear);
    startD.setUTCDate(startOfYear.getUTCDate() + (w - 1) * 7);

    const start = startD.toISOString().split('T')[0];
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const end = endD.toISOString().split('T')[0];

    return { start, end };
}

export default function BudgetPage() {
    const [week, setWeek] = useState(42)
    const [range, setRange] = useState(getWeekRange(42))
    const [schedule, setSchedule] = useState([])
    const [staff, setStaff] = useState([])
    const [budgetMap, setBudgetMap] = useState({})

    const changeWeek = (w) => {
        setWeek(w)
        setRange(getWeekRange(w))
    }

    const days = getDatesInRange(range.start, range.end)

    useEffect(() => {
        loadData()
    }, [range])

    async function loadData() {
        try {
            const [sch, stf, bdg] = await Promise.all([
                api.getSchedule(range.start, range.end),
                api.getStaff(),
                api.getBudget()
            ])
            setSchedule(sch)
            setStaff(stf)

            const bMap = {}
            bdg.forEach(b => {
                bMap[b.data] = {
                    valueLunch: b.valueLunch || 0,
                    valueDinner: b.valueDinner || 0,
                    hoursLunch: b.hoursLunch || 0,
                    hoursDinner: b.hoursDinner || 0,
                    value: b.value || 0 // Total
                }
            })
            setBudgetMap(bMap)

        } catch (e) {
            alert("Errore caricamento dati: " + e.message)
        }
    }

    const calcHours = (start, end) => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number)
        const [h2, m2] = end.split(':').map(Number)
        let diff = (h2 + m2 / 60) - (h1 + m1 / 60)
        if (diff < 0) diff += 24
        return diff
    }

    const getStats = (date) => {
        let hl = 0, hd = 0;
        schedule.filter(a => a.data === date).forEach(a => {
            let start = a.start_time;
            let end = a.end_time;
            if (!start && a.shiftTemplate) {
                start = a.shiftTemplate.oraInizio;
                end = a.shiftTemplate.oraFine;
            }
            if (start && end) {
                const [h1, m1] = start.split(':').map(Number)
                const [h2, m2] = end.split(':').map(Number)

                let startDec = h1 + m1 / 60
                let endDec = h2 + m2 / 60
                if (endDec < startDec) endDec += 24 // Cross midnight

                const CUTOFF = 17.0;

                // Lunch overlap
                if (startDec < CUTOFF) {
                    const lEnd = Math.min(endDec, CUTOFF);
                    hl += (lEnd - startDec);
                }

                // Dinner overlap
                if (endDec > CUTOFF) {
                    const dStart = Math.max(startDec, CUTOFF);
                    hd += (endDec - dStart);
                }
            }
        });
        return { hl: parseFloat(hl.toFixed(2)), hd: parseFloat(hd.toFixed(2)) };
    }

    const updateLocalState = (date, field, val) => {
        const old = budgetMap[date] || { valueLunch: 0, valueDinner: 0, hoursLunch: 0, hoursDinner: 0, value: 0 }
        const parsed = parseFloat(val) || 0;
        const newItem = { ...old, [field]: parsed }

        // Auto-update total value if euro changed
        if (field === 'valueLunch' || field === 'valueDinner') {
            const l = field === 'valueLunch' ? parsed : (newItem.valueLunch || 0);
            const d = field === 'valueDinner' ? parsed : (newItem.valueDinner || 0);
            newItem.value = l + d;
        }

        setBudgetMap({ ...budgetMap, [date]: newItem })
    }

    const persistRow = async (date) => {
        const item = budgetMap[date];
        if (!item) return;

        try {
            await api.upsertBudget({
                data: date,
                valueLunch: item.valueLunch,
                valueDinner: item.valueDinner,
                hoursLunch: item.hoursLunch,
                hoursDinner: item.hoursDinner,
                value: item.value
            })
        } catch (e) {
            console.error("Save failed for " + date, e)
        }
    }

    const saveAll = async () => {
        try {
            const promises = days.map(d => persistRow(d));
            await Promise.all(promises);
            alert("Dati salvati con successo! ✅");
        } catch (e) {
            alert("Errore durante il salvataggio: " + e.message);
        }
    }

    const handleForecastImport = (e) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'binary' })
                const ws = wb.Sheets[wb.SheetNames[0]]
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

                // Logic from TurniPage.jsx
                const DATE_ROW_IDX = 5
                let IDX_HOURS_L = 7;
                let IDX_HOURS_D = 10;
                let IDX_EURO = 14;

                const lIdx = rows.findIndex(r => r && String(r[0]).toLowerCase().includes('real pranzo'));
                if (lIdx !== -1) IDX_HOURS_L = lIdx;

                const dIdx = rows.findIndex(r => r && String(r[0]).toLowerCase().includes('real cena'));
                if (dIdx !== -1) IDX_HOURS_D = dIdx;

                const eIdx = rows.findIndex(r => r && String(r[0]).toLowerCase().includes('real day'));
                if (eIdx !== -1) IDX_EURO = eIdx;

                if (!rows[DATE_ROW_IDX]) {
                    alert("Errore formato file: Riga date non trovata.")
                    return
                }

                const rowDates = rows[DATE_ROW_IDX]
                const rowHL = rows[IDX_HOURS_L] || []
                const rowHD = rows[IDX_HOURS_D] || []
                const rowEuro = rows[IDX_EURO] || []

                const parseEuro = (val) => {
                    if (!val) return 0
                    let s = String(val).replace(/€/g, '').replace(/./g, '').replace(/,/g, '.').trim()
                    return parseFloat(val) || parseFloat(s) || 0
                }

                const parseDate = (val) => {
                    if (!val) return null
                    if (typeof val === 'number') {
                        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                        return date.toISOString().split('T')[0];
                    }
                    const dStr = String(val).trim();
                    if (dStr.includes('/')) {
                        const parts = dStr.split('/')
                        if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                    }
                    const dObj = new Date(dStr);
                    if (!isNaN(dObj.getTime())) return dObj.toISOString().split('T')[0];
                    return null
                }

                const promises = [];
                let count = 0;

                for (let i = 1; i < rowDates.length; i++) {
                    const dateStr = parseDate(rowDates[i])
                    if (dateStr) {
                        const hL = parseEuro(rowHL[i])
                        const hD = parseEuro(rowHD[i])
                        const valEuro = parseEuro(rowEuro[i])

                        promises.push(api.upsertBudget({
                            data: dateStr,
                            value: valEuro,
                            hoursLunch: hL,
                            hoursDinner: hD
                        }));
                        count++
                    }
                }

                await Promise.all(promises)
                alert(`Importazione Forecast Completata: ${count} giorni aggiornati.`)
                loadData()
            } catch (ex) {
                console.error(ex)
                alert("Errore importazione: " + ex.message)
            }
        }
        reader.readAsBinaryString(file)
    }

    const exportToExcel = () => {
        const rows = []
        // Header
        rows.push(['Data', 'Budget € (P)', 'Budget € (S)', 'Budget Ore (P)', 'Budget Ore (S)', 'Ore Reali (P)', 'Ore Reali (S)', 'Prod € (P)', 'Prod € (S)', 'Prod € (Tot)'])

        days.forEach(d => {
            const b = budgetMap[d] || { valueLunch: 0, valueDinner: 0, hoursLunch: 0, hoursDinner: 0 }
            const s = getStats(d)
            const prodP = s.hl > 0 ? (b.valueLunch / s.hl).toFixed(2) : 0
            const prodS = s.hd > 0 ? (b.valueDinner / s.hd).toFixed(2) : 0

            const totVal = (b.valueLunch || 0) + (b.valueDinner || 0)
            const totHours = s.hl + s.hd
            const prodTot = totHours > 0 ? (totVal / totHours).toFixed(2) : 0

            rows.push([
                d,
                b.valueLunch,
                b.valueDinner,
                b.hoursLunch,
                b.hoursDinner,
                s.hl,
                s.hd,
                prodP,
                prodS,
                prodTot
            ])
        })

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, "Budget_Forecast")
        XLSX.writeFile(wb, `Budget_Forecast_${range.start}_${range.end}.xlsx`)
    }

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Gestione Forecast & Budget</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <label className="btn" style={{ background: '#009688', color: 'white', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>
                        Importa Forecast (CSV/XLS)
                        <input type="file" style={{ display: 'none' }} onChange={handleForecastImport} accept=".csv, .xlsx" />
                    </label>
                </div>
            </div>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', background: '#f5f5f5', padding: '10px', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                    Seleziona Settimana:
                    <select className="input" value={week} onChange={e => changeWeek(Number(e.target.value))} style={{ fontSize: '1.2rem', padding: '5px' }}>
                        {Array.from({ length: 53 }, (_, i) => i + 1).map(w => {
                            const { start, end } = getWeekRange(w);
                            return (
                                <option key={w} value={w}>
                                    W{w} ({start} - {end})
                                </option>
                            )
                        })}
                    </select>
                </label>

                <span style={{ margin: '0 20px', color: '#666' }}>
                    ({range.start} - {range.end})
                </span>

                <button className="btn" onClick={saveAll} style={{ background: '#2196f3', color: 'white' }}>💾 Salva Tutto</button>
                <button className="btn" onClick={loadData} style={{ marginLeft: '10px' }}>🔄 Ricarica</button>
                <button className="btn" onClick={exportToExcel} style={{ background: '#4caf50', color: 'white' }}>📥 Esporta Excel</button>
            </div>

            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Data</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', background: '#fff9c4' }}>Budget € (P)</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', background: '#e0f7fa' }}>Budget € (S)</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Budget Ore (P)</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Budget Ore (S)</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Ore Reali (P)</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Ore Reali (S)</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Produttività (P)</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd' }}>Produttività (S)</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', background: '#e1bee7' }}>Prod. Giornaliera</th>
                    </tr>
                </thead>
                <tbody>
                    {days.map(d => {
                        const b = budgetMap[d] || { valueLunch: 0, valueDinner: 0, hoursLunch: 0, hoursDinner: 0 }
                        const s = getStats(d)

                        const prodP = s.hl > 0 ? (b.valueLunch / s.hl).toFixed(2) : '-'
                        const prodS = s.hd > 0 ? (b.valueDinner / s.hd).toFixed(2) : '-'

                        const totVal = (b.valueLunch || 0) + (b.valueDinner || 0)
                        const totHours = s.hl + s.hd
                        const prodTot = totHours > 0 ? (totVal / totHours).toFixed(2) : '-'

                        return (
                            <tr key={d} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '5px', border: '1px solid #ddd' }}>
                                    {d.split('-').reverse().join('/')} <br />
                                    <small>{new Date(d).toLocaleDateString('it-IT', { weekday: 'long' })}</small>
                                </td>

                                <td style={{ padding: '5px', border: '1px solid #ddd', background: '#fff9c4', textAlign: 'center' }}>
                                    <input className="input" type="number"
                                        style={{ width: '80px', textAlign: 'right' }}
                                        value={b.valueLunch || ''}
                                        onChange={e => updateLocalState(d, 'valueLunch', e.target.value)}
                                        onBlur={() => persistRow(d)}
                                        placeholder="€" />
                                </td>
                                <td style={{ padding: '5px', border: '1px solid #ddd', background: '#e0f7fa', textAlign: 'center' }}>
                                    <input className="input" type="number"
                                        style={{ width: '80px', textAlign: 'right' }}
                                        value={b.valueDinner || ''}
                                        onChange={e => updateLocalState(d, 'valueDinner', e.target.value)}
                                        onBlur={() => persistRow(d)}
                                        placeholder="€" />
                                </td>

                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                    <input className="input" type="number"
                                        style={{ width: '60px', textAlign: 'center' }}
                                        value={b.hoursLunch || ''}
                                        onChange={e => updateLocalState(d, 'hoursLunch', e.target.value)}
                                        onBlur={() => persistRow(d)}
                                        placeholder="h" />
                                </td>
                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>
                                    <input className="input" type="number"
                                        style={{ width: '60px', textAlign: 'center' }}
                                        value={b.hoursDinner || ''}
                                        onChange={e => updateLocalState(d, 'hoursDinner', e.target.value)}
                                        onBlur={() => persistRow(d)}
                                        placeholder="h" />
                                </td>

                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>{s.hl}</td>
                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center' }}>{s.hd}</td>

                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center', color: '#4a148c', fontWeight: 'bold' }}>
                                    {prodP !== '-' ? `€ ${prodP}` : '-'}
                                </td>
                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center', color: '#4a148c', fontWeight: 'bold' }}>
                                    {prodS !== '-' ? `€ ${prodS}` : '-'}
                                </td>
                                <td style={{ padding: '5px', border: '1px solid #ddd', textAlign: 'center', background: '#f3e5f5', color: '#4a148c', fontWeight: 'bold' }}>
                                    {prodTot !== '-' ? `€ ${prodTot}` : '-'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
