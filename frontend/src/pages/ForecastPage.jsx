import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import api from '../util/api'

// Helper per gestire le settimane
function getWeekRange(d = new Date()) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

    // Calcola start (Lun) e end (Dom)
    const simple = new Date(d.valueOf());
    const day = simple.getUTCDay() || 7;
    simple.setUTCDate(simple.getUTCDate() - day + 1);
    const startIso = simple.toISOString().slice(0, 10);
    simple.setUTCDate(simple.getUTCDate() + 6);
    const endIso = simple.toISOString().slice(0, 10);

    return { week: weekNo, year: d.getUTCFullYear(), start: startIso, end: endIso, label: `${weekNo} (${startIso})` };
}

function getWeeksList() {
    const arr = []
    // Genera settimane da Gennaio 2025 a Giugno 2026
    let curr = new Date(Date.UTC(2025, 0, 1)) // Inizio 2025
    // Trova il primo lunedì
    while (curr.getUTCDay() !== 1) {
        curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const end = new Date(Date.UTC(2026, 5, 1)) // Giugno 2026

    while (curr < end) {
        arr.push(getWeekRange(new Date(curr))) // Clona data
        curr.setUTCDate(curr.getUTCDate() + 7)
    }
    return arr
}

// FORMATO ITALIANO: Punti = Migliaia (rimuovere), Virgole = Decimali (sostituire con punto)
const parseNumberIT = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;

    let s = String(val).trim();
    // Pulisci simboli strani
    s = s.replace(/€/g, '').replace(/[^0-9.,-]/g, '');

    // Gestione formato: 1.000,00
    // Se c'è una virgola, è sicuramente il decimale -> Rimuovi punti, cambia virgola in punto
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else {
        // Se non c'è virgola, ma ci sono punti:
        // Caso "2.700" -> 2700 (Migliaia)
        // Caso "2.5" -> 25 (Errore se era inglese) -> MA QUI SIAMO IN ITALIA
        // Assumiamo che se l'utente digita "2.5" in un campo ore, intenda 2 ore e mezzo?
        // In excel ita "2,5". 
        // Per sicurezza: Rimuoviamo TUTTI i punti se assumiamo input IT rigoroso.
        s = s.replace(/\./g, '');
    }

    return parseFloat(s) || 0;
}

const formatNumberIT = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '';
    return val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ForecastPage() {
    const [weeks] = useState(getWeeksList())
    // Trova settimana corrente di default
    const todayWeek = getWeekRange(new Date())
    const initialWeek = weeks.find(w => w.start === todayWeek.start) || weeks[weeks.length - 1] || weeks[0]

    const [selectedWeek, setSelectedWeek] = useState(initialWeek)
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadForecast(selectedWeek.start)
    }, [selectedWeek])

    const loadForecast = async (weekStart) => {
        setLoading(true)
        try {
            const res = await api.getForecast(weekStart, weekStart) // Modifica API per accettare range o singola data
            // Se esiste, lo usiamo. Altrimenti array vuoto.
            // L'API ritorna [{ data: "...", weekStart: "..." }]
            // Qui assumiamo che api.getForecast ritorni l'oggetto JSON salvato

            // In realtà api.getForecast è generica. Adattiamo.
            // Se non c'è forecast salvato, resetta data
            if (res && res.length > 0 && res[0].data) {
                try {
                    const parsed = JSON.parse(res[0].data)
                    setData(parsed)
                } catch (e) { setData([]) }
            } else {
                setData([])
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const applyFormulas = (grid) => {
        if (!grid || grid.length === 0) return grid
        const newGrid = grid.map(row => [...row])

        let idxBudP = -1, idxRealP = -1
        let idxBudS = -1, idxRealS = -1
        let idxBudD = -1, idxRealD = -1
        let idxOreBud = -1, idxOreReal = -1
        let idxProdBud = -1, idxProdReal = -1

        newGrid.forEach((row, rIdx) => {
            const l = String(row[0] || '').toLowerCase()
            if (l.includes('budget') && l.includes('pranzo')) idxBudP = rIdx
            if (l.includes('real') && l.includes('pranzo')) idxRealP = rIdx
            if (l.includes('budget') && l.includes('cena')) idxBudS = rIdx
            if (l.includes('real') && l.includes('cena')) idxRealS = rIdx
            if (l.includes('budget') && (l.includes('day') || l.includes('giornaliero'))) idxBudD = rIdx
            if (l.includes('real') && (l.includes('day') || l.includes('giornaliero'))) idxRealD = rIdx
            if ((l.includes('ore') && l.includes('budget')) || l.includes('ore previste')) idxOreBud = rIdx
            if (l.includes('ore') && (l.includes('lavorate') || l.includes('reali'))) idxOreReal = rIdx
            if (l.includes('produttività') && l.includes('budget')) idxProdBud = rIdx
            if (l.includes('produttività') && (l.includes('real') || l.includes('week'))) idxProdReal = rIdx
        })

        for (let col = 1; col <= 7; col++) {
            const get = (r) => {
                if (r === -1 || !newGrid[r]) return 0;
                return parseNumberIT(newGrid[r][col]);
            }
            const set = (r, val) => {
                if (r !== -1 && newGrid[r]) newGrid[r][col] = formatNumberIT(val);
            }

            // BUDGET €
            const bP = get(idxBudP), bS = get(idxBudS), bD = get(idxBudD)
            if (idxBudD !== -1 && idxBudP !== -1 && idxBudS !== -1 && bD > 0) set(idxBudS, bD - bP)
            else if (idxBudD !== -1 && (bP > 0 || bS > 0)) set(idxBudD, bP + bS)

            // REAL €
            const rP = get(idxRealP), rS = get(idxRealS), rD = get(idxRealD)
            if (idxRealD !== -1 && rD > 0 && rP > 0 && idxRealS !== -1) set(idxRealS, rD - rP)
            else if (idxRealD !== -1 && (rP > 0 || rS > 0)) set(idxRealD, rP + rS)

            // PRODUTTIVITÀ
            const fBD = get(idxBudD), fRD = get(idxRealD)
            const hB = get(idxOreBud), hR = get(idxOreReal)

            // Prod Budget = Budget Day / Ore Budget
            if (idxProdBud !== -1 && hB > 0 && fBD > 0) set(idxProdBud, fBD / hB)

            // Prod Real = Real Day / (Ore Reali o Ore Budget)
            const div = hR > 0 ? hR : hB
            if (idxProdReal !== -1 && div > 0 && fRD > 0) set(idxProdReal, fRD / div)
        }
        return newGrid
    }

    const cleanCell = (cell) => {
        if (cell == null) return ''
        let v = String(cell).trim()
        // Fix caratteri
        v = v.replace(/â[^\s\d\w]*/g, '').replace(/[€¬ÐÂ]/g, '')
        const fix = { 'Ã¬': 'ì', 'Ã ': 'à', 'Ã¨': 'è', 'Ã¹': 'ù', 'Ã²': 'ò', 'LunedÃ': 'Lunedì', 'MartedÃ': 'Martedì', 'MercoledÃ': 'Mercoledì', 'GiovedÃ': 'Giovedì', 'VenerdÃ': 'Venerdì', 'ProduttivitÃ': 'Produttività' }
        for (let k in fix) if (v.includes(k)) v = v.replaceAll(k, fix[k])

        // NON TOCCHIAMO TROPPO I NUMERI QUI, lasciamo il formato "sporco" (es. 2.700) 
        // per essere parsato correttamente da parseNumberIT quando serve.
        // Puliamo solo spazi e valuta.
        return v
    }

    const saveToDb = async (dataToSave) => {
        try {
            await api.saveForecast([{ weekStart: selectedWeek.start, data: JSON.stringify(dataToSave) }])
            return true
        } catch (e) {
            alert('Errore Salvataggio: ' + e.message)
            return false
        }
    }

    const handleImport = (e) => {
        const file = e.target.files[0]
        // Resetta il valore per permettere di ricaricare lo stesso file se necessario
        // Ma fallo DOPO aver preso il riferimento al file!
        e.target.value = null

        if (!file) return

        setLoading(true)
        // Usa setTimeout per permettere rendering UI loading
        setTimeout(() => {
            const reader = new FileReader()
            reader.onload = async (evt) => {
                try {
                    const wb = XLSX.read(evt.target.result, { type: 'binary' })
                    let rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })

                    // FIX CSV ;
                    if (rows.length > 0 && rows[0] && rows[0].length === 1 && String(rows[0][0]).includes(';')) {
                        rows = rows.map(r => {
                            if (r && r[0]) return String(r[0]).split(';')
                            return []
                        })
                    }

                    let cRows = rows.map(r => r.map(c => cleanCell(c)))

                    // Header Fix
                    if (cRows[0]) {
                        const h = String(cRows[0][0]).toLowerCase()
                        if (h.includes('luned') || h.includes('mond')) cRows[0].unshift('Dettaglio')
                    }

                    // CHECK DATE
                    let foundDate = null
                    for (let r = 0; r < Math.min(cRows.length, 5); r++) {
                        const cell = cRows[r][1]
                        if (cell && typeof cell === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cell.trim())) {
                            const parts = cell.trim().split('/')
                            foundDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
                            break
                        }
                    }

                    if (foundDate && foundDate !== selectedWeek.start) {
                        if (!window.confirm(`⚠️ ATTENZIONE DATE!\n\nIl file contiene la data: ${foundDate}\nMa stai importando nella settimana: ${selectedWeek.start}\n\nLe date NON CORRISPONDONO. Vuoi procedere comunque?`)) {
                            return
                        }
                    }

                    // Ensure Rows
                    const has = (t) => cRows.some(r => String(r[0]).toLowerCase().includes(t))
                    if (!has('ore budget')) cRows.push(['Ore Budget', '', '', '', '', '', '', ''])
                    if (!has('produttività budget')) cRows.push(['Produttività Budget', '', '', '', '', '', '', ''])
                    if (!has('produttività')) cRows.push(['Produttività Real', '', '', '', '', '', '', ''])

                    const calc = applyFormulas(cRows)
                    setData(calc)

                    // AUTO SAVE IMMEDIATO
                    const ok = await saveToDb(calc)
                    if (ok) alert(`✅ Dati importati e SALVATI per la settimana ${selectedWeek.label}`)

                } catch (error) {
                    console.error(error)
                    alert('❌ ERRORE GRAVE DURANTE IMPORTAZIONE: ' + error.message)
                } finally {
                    setLoading(false)
                }
            }
            reader.onerror = () => {
                alert('Errore lettura file')
                setLoading(false)
            }
            reader.readAsBinaryString(file)
        }, 50)
    }

    const handleUpdate = (r, c, val) => {
        const d = [...data]
        d[r][c] = val
        setData(applyFormulas(d))
        // Opzionale: Auto-save anche su edit? Meglio di no per performance, o debounce.
        // Lasciamo manuale per edit piccoli.
    }

    const handleSave = async () => {
        setLoading(true)
        const ok = await saveToDb(data)
        if (ok) alert('✅ Salvataggio Manuale Eseguito!')
        setLoading(false)
    }

    const handleDelete = async () => {
        if (confirm(`⛔ SEI SICURO?\n\nVuoi CANCELLARE DEFINITIVAMENTE tutti i dati forecast per la settimana ${selectedWeek.label}?\n\nQuesta azione è irreversibile.`)) {
            const ok = await saveToDb([]) // Salva array vuoto
            if (ok) {
                setData([])
                alert('🗑️ Dati rimossi correttamente.')
            }
        }
    }

    const handleExport = () => {
        try {
            const wb = XLSX.utils.book_new()
            const ws = XLSX.utils.aoa_to_sheet(data)
            XLSX.utils.book_append_sheet(wb, ws, "Forecast")
            XLSX.writeFile(wb, `Forecast_${selectedWeek.start}.xlsx`)
        } catch (e) { alert('Errore Export: ' + e.message) }
    }

    // Manual Init con Auto Save
    const handleManualInit = async () => {
        const template = [
            ['Dettaglio', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'],
            ['Budget pranzo', '0', '0', '0', '0', '0', '0', '0'],
            ['Real pranzo', '0', '0', '0', '0', '0', '0', '0'],
            ['Budget cena', '0', '0', '0', '0', '0', '0', '0'],
            ['Real cena', '0', '0', '0', '0', '0', '0', '0'],
            ['Budget day', '0', '0', '0', '0', '0', '0', '0'],
            ['Real day', '0', '0', '0', '0', '0', '0', '0'],
            ['Ore Budget', '0', '0', '0', '0', '0', '0', '0'],
            ['Ore lavorate', '0', '0', '0', '0', '0', '0', '0'],
            ['Produttività Budget', '0', '0', '0', '0', '0', '0', '0'],
            ['Produttività Real', '0', '0', '0', '0', '0', '0', '0'],
        ]
        setData(template)
        await saveToDb(template) // Salva subito
    }

    return (
        <div style={{ padding: '20px', background: '#f5f7fa', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, color: '#2c3e50' }}>📊 Forecast Manager</h1>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>Settimana:</span>
                    <select
                        value={selectedWeek.start}
                        onChange={(e) => setSelectedWeek(weeks.find(w => w.start === e.target.value))}
                        style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                    >
                        {weeks.map(w => (
                            <option key={w.start} value={w.start}>Sett {w.week}: {w.start} - {w.end}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <label className="btn" style={{ backgroundColor: '#3498db', color: 'white', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>
                    📁 Importa CSV
                    <input type="file" style={{ display: 'none' }} onChange={handleImport} onClick={(e) => e.target.value = null} accept=".csv, .xlsx" />
                </label>
                {data.length > 0 && (
                    <>
                        <button className="btn" style={{ backgroundColor: '#27ae60', color: 'white', padding: '10px 20px', borderRadius: '6px' }} onClick={handleSave}>
                            💾 Salva (Sett. {selectedWeek.week})
                        </button>
                        <button className="btn" style={{ backgroundColor: '#e67e22', color: 'white', padding: '10px 20px', borderRadius: '6px' }} onClick={handleExport}>
                            📥 Scarica
                        </button>
                        <button className="btn" style={{ backgroundColor: '#c0392b', color: 'white', padding: '10px 20px', borderRadius: '6px' }} onClick={handleDelete}>
                            🗑️ Elimina Dati
                        </button>
                    </>
                )}
            </div>

            {data.length > 0 ? (
                <div style={{ overflowX: 'auto', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                                {data[0].map((h, i) => <th key={i} style={{ padding: '12px', textAlign: 'left' }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.slice(1).map((row, rIdx) => (
                                <tr key={rIdx} style={{ background: rIdx % 2 ? '#f8f9fa' : 'white' }}>
                                    {row.map((cell, cIdx) => {
                                        // Editabili: colonne 1-7, righe Budget/Real/Ore
                                        const l = String(row[0] || '').toLowerCase()
                                        const isEdit = (cIdx >= 1 && cIdx <= 7) && (l.includes('budget') || l.includes('real') || l.includes('ore') || l.includes('day'))

                                        if (isEdit) {
                                            return (
                                                <td key={cIdx} style={{ padding: 0, border: '1px solid #eee', height: '100%' }}>
                                                    <input
                                                        type="text"
                                                        value={cell}
                                                        onChange={(e) => handleUpdate(rIdx + 1, cIdx, e.target.value)}
                                                        style={{
                                                            width: '100%', height: '100%',
                                                            minHeight: '40px',
                                                            padding: '0 10px',
                                                            border: '2px solid transparent',
                                                            textAlign: 'right',
                                                            background: 'transparent',
                                                            color: '#2980b9',
                                                            fontWeight: 'bold',
                                                            fontSize: '1em',
                                                            outline: 'none',
                                                            fontFamily: 'inherit',
                                                            boxSizing: 'border-box'
                                                        }}
                                                        onFocus={e => { e.target.style.borderBottom = '2px solid #3498db'; e.target.style.background = '#e3f2fd'; }}
                                                        onBlur={e => { e.target.style.borderBottom = '2px solid transparent'; e.target.style.background = 'transparent'; }}
                                                    />
                                                </td>
                                            )
                                        }
                                        return <td key={cIdx} style={{ padding: '10px', textAlign: 'right', border: '1px solid #eee' }}>{cell}</td>
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '50px', background: 'white', borderRadius: '10px' }}>
                    <p style={{ marginBottom: '20px', color: '#7f8c8d' }}>Nessun dato per la settimana {selectedWeek.week}.</p>
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                        <button
                            className="btn"
                            style={{ backgroundColor: '#9b59b6', color: 'white', padding: '15px 30px', borderRadius: '8px', fontSize: '1.1em', cursor: 'pointer' }}
                            onClick={handleManualInit}
                        >
                            ➕ Crea Tabella Vuota
                        </button>
                    </div>
                </div>
            )}

        </div>
    )
}

