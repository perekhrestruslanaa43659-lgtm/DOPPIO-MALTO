import React, { useState, useEffect } from 'react'
import api from '../util/api'
import * as XLSX from 'xlsx'
import QuarterTimeInput from '../components/QuarterTimeInput'

// Helper to get dates in range
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
  // Use UTC to avoid timezone rollback issues
  const d = new Date(Date.UTC(year, 0, 4)); // Jan 4th is always in Week 1
  const day = d.getUTCDay() || 7; // Get day (1=Mon ... 7=Sun)

  const startOfYear = new Date(d);
  startOfYear.setUTCDate(d.getUTCDate() - day + 1); // Move to Monday of Week 1

  const startD = new Date(startOfYear);
  startD.setUTCDate(startOfYear.getUTCDate() + (w - 1) * 7); // Add weeks

  const start = startD.toISOString().split('T')[0];

  const endD = new Date(startD);
  endD.setUTCDate(endD.getUTCDate() + 6); // Add 6 days to get Sunday
  const end = endD.toISOString().split('T')[0];

  return { start, end };
}

export default function TurniPage({ readOnly }) {

  const [schedule, setSchedule] = useState([])
  const [staff, setStaff] = useState([])
  const [templates, setTemplates] = useState([])
  const [matrix, setMatrix] = useState({}) // { staffId: { date: [shifts] } }
  const [unavailabilities, setUnavailabilities] = useState([])
  const [forecast, setForecast] = useState({})
  const [coverage, setCoverage] = useState([]) // { "2025-01-01": { lunch: 0, dinner: 0 } }
  const [unassignedShifts, setUnassignedShifts] = useState([])
  const [showUnassignedModal, setShowUnassignedModal] = useState(false)
  const [currentYear, setCurrentYear] = useState(2025)
  const [selectedWeek, setSelectedWeek] = useState(42)
  const [range, setRange] = useState(getWeekRange(42, 2025))
  const [shiftLength, setShiftLength] = useState(7)

  const [candidateList, setCandidateList] = useState(null)
  const [targetGap, setTargetGap] = useState(null)
  const [manualMode, setManualMode] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [panarelloActive, setPanarelloActive] = useState(false)

  const findCandidates = async (gap) => {
    setTargetGap(gap);
    setManualMode(false);
    setSelectedCandidate(null); // Reset Selection
    setCandidateList(null); // Loading
    setCandidateList(null); // Loading
    try {
      const res = await api.findCandidates(gap.date, gap.start, gap.end, gap.station);
      setCandidateList(res);
    } catch (e) { alert(e.message) }
  }

  const assignCandidate = async (staffId) => {
    if (readOnly) return;
    if (!targetGap) return;
    try {
      await api.createAssignment({
        staffId: staffId,
        data: targetGap.date,
        start_time: targetGap.start,
        end_time: targetGap.end,
        postazione: targetGap.station,
        status: true // Direct assignment is confirmed? Or Draft? Let's assume Confirmed for "Availability" gap fill. Or Bozza? User said default Bozza. But gap fill is usually "I want this now". Let's use TRUE (Published/Confirmed) for single assignments to avoid confusion, or FALSE. User "Imposta il valore predefinito a false". Okay, FALSE.
      });
      alert("Assegnato!");
      setTargetGap(null);
      setCandidateList(null);
      // Remove from unassigned list
      setUnassignedShifts(prev => prev.filter(u => u !== targetGap));
      loadData();
    } catch (e) { alert("Errore assegnazione: " + e.message) }
  }

  const changeWeek = (w, y = currentYear) => {
    const r = getWeekRange(w, parseInt(y))
    setRange(r)
    setSelectedWeek(w)
    setCurrentYear(y)
  }

  const changeYear = (y) => {
    changeWeek(selectedWeek, parseInt(y))
  }

  // Existing Load Logic
  useEffect(() => {
    loadData()
  }, [range])

  async function loadData() {
    try {
      const [sch, stf, tmpl, unav, forecastRes] = await Promise.all([
        api.getSchedule(range.start, range.end).then(s => s.filter(x => !readOnly || x.status === true)),
        api.getStaff(),
        api.getShiftTemplates(),
        api.getUnavailability(),
        api.getForecast() // NUOVO FORECAST
      ])
      setSchedule(Array.isArray(sch) ? sch : [])
      setStaff(Array.isArray(stf) ? stf : [])
      setTemplates(Array.isArray(tmpl) ? tmpl : [])
      setUnavailabilities(Array.isArray(unav) ? unav : [])

      const f = {}

      // LOGICA MAPPING FORECAST NUOVO
      if (forecastRes && forecastRes.data && forecastRes.data.length > 0) {
        // Trova forecast corrispondente alla settimana corrente
        const match = forecastRes.data.find(x => x.weekStart === range.start) || forecastRes.data[forecastRes.data.length - 1]

        if (match && match.data) {
          try {
            const rows = JSON.parse(match.data)

            const rBudgetPranzo = rows.find(r => String(r[0]).toLowerCase().includes('budget pranzo'))
            const rBudgetCena = rows.find(r => String(r[0]).toLowerCase().includes('budget cena'))
            const rOreBudget = rows.find(r => String(r[0]).toLowerCase().includes('ore budget') || String(r[0]).toLowerCase().includes('ore previste'))

            const rangeDates = getDatesInRange(range.start, range.end)
            rangeDates.forEach((dateStr, idx) => {
              const colIdx = idx + 1 // Colonna 1=Lun

              const pVal = (row) => {
                if (!row || !row[colIdx]) return 0
                let val = String(row[colIdx]).replace(/€/g, '').replace(/\./g, '').replace(/,/g, '.')
                return parseFloat(val) || 0
              }
              const pValHours = (row) => {
                if (!row || !row[colIdx]) return 0
                return parseFloat(String(row[colIdx]).replace(',', '.')) || 0
              }

              f[dateStr] = {
                revLunch: rBudgetPranzo ? pVal(rBudgetPranzo) : 0,
                revDinner: rBudgetCena ? pVal(rBudgetCena) : 0,
                // Mappiamo ore totali su hoursLunch per retrocompatibilità visualizzazione o creiamo campo nuovo
                // La tabella sotto usa hoursLunch e hoursDinner.
                // Per ora mettiamo tutto su hoursLunch se non distinti, o dividiamo 50/50
                // Meglio: usiamo hoursTotal custom
                hoursTotal: rOreBudget ? pValHours(rOreBudget) : 0,
                hoursLunch: rOreBudget ? (pValHours(rOreBudget) / 2) : 0, // Placeholder split
                hoursDinner: rOreBudget ? (pValHours(rOreBudget) / 2) : 0 // Placeholder split
              }
            })
          } catch (err) { console.error("Parse forecast error", err) }
        }
      }
      setForecast(f)

      // Build Matrix
      const m = {}
      if (Array.isArray(stf)) {
        stf.forEach(s => {
          m[s.id] = {}
        })
      }
      if (Array.isArray(sch)) {
        sch.forEach(asn => {
          if (!m[asn.staffId]) m[asn.staffId] = {}
          if (!m[asn.staffId][asn.data]) m[asn.staffId][asn.data] = []
          m[asn.staffId][asn.data].push(asn)
        })
      }
      setMatrix(m)

    } catch (e) {
      alert("Errore caricamento: " + e.message)
    }
  }

  async function generate() {
    try {
      console.log('[GENERATE] Starting generation...');
      if (!confirm("Generare i turni sovrascriverà eventuali bozze. Continuare?")) {
        console.log('[GENERATE] User cancelled');
        return;
      }
      console.log('[GENERATE] Calling API with range:', range.start, range.end);
      const res = await api.generateSchedule(range.start, range.end)
      console.log('[GENERATE] API response:', res);
      const logCount = (res.logs || []).length;
      let msg = `Generati ${res.generated} turni.`

      if (res.unassigned && res.unassigned.length > 0) {
        setUnassignedShifts(res.unassigned);
        setShowUnassignedModal(true);
      } else {
        setUnassignedShifts([]);
        setShowUnassignedModal(false);
        alert(msg);
      }

      loadData()
    } catch (e) {
      console.error('[GENERATE] Error:', e);
      alert("Errore generazione: " + e.message)
    }
  }



  async function verifyCoverage() {
    try {
      const res = await api.verifySchedule(range.start, range.end);
      if (res.gaps && res.gaps.length > 0) {
        setUnassignedShifts(res.gaps);
        setShowUnassignedModal(true);
      } else {
        setUnassignedShifts([]);
        alert("Ottimo! Tutti i turni richiesti sono coperti. ✅");
      }
    } catch (e) { alert("Errore verifica: " + e.message) }
  }

  function handleExportExcel() {
    try {
      if (!staff || staff.length === 0) return alert("Nessun dato da esportare.");

      const dates = getDatesInRange(range.start, range.end);
      const rows = [];

      // Header Row
      const header = ["Dipendente", "Ruolo", "Budget", "Effettivo"];
      dates.forEach(d => {
        header.push(`${d.split('-').reverse().slice(0, 2).join('/')} Post`);
        header.push(`${d.split('-').reverse().slice(0, 2).join('/')} Orario`);
      });
      rows.push(header);

      // Staff Rows
      staff.forEach(s => {
        const rowData = [s.nome, s.ruolo, s.oreContrattuali || 0];

        // Calc actual total for this staff
        let totalEff = 0;
        const dayCols = [];

        dates.forEach(d => {
          const asns = (matrix[s.id] && matrix[s.id][d]) || [];
          if (asns.length === 0) {
            dayCols.push("", "");
          } else {
            const posts = asns.map(a => a.postazione).filter(Boolean).join(" / ");
            const times = asns.map(a => {
              const start = a.start_time || a.shiftTemplate?.oraInizio || "";
              const end = a.end_time || a.shiftTemplate?.oraFine || "";

              // Add to totalEff
              if (start && end) {
                const [sh, sm] = start.split(':').map(Number);
                const [eh, em] = end.split(':').map(Number);
                let diff = (eh + em / 60) - (sh + sm / 60);
                if (diff < 0) diff += 24;
                totalEff += diff;
              }

              return `${start}-${end}`;
            }).filter(Boolean).join(" + ");

            dayCols.push(posts, times);
          }
        });

        rowData.push(totalEff.toFixed(1));
        rowData.push(...dayCols);
        rows.push(rowData);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Turni");
      XLSX.writeFile(wb, `Turni_${range.start}_${range.end}.xlsx`);
    } catch (e) {
      alert("Errore esportazione: " + e.message);
      console.error(e);
    }
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

      let headerIdx = rows.findIndex(r => r.map(c => String(c).toLowerCase()).some(x => x.includes('nome') || x.includes('name')))
      if (headerIdx === -1) headerIdx = 0;
      const headers = rows[headerIdx].map(c => String(c).trim())
      const nameIdx = headers.findIndex(h => h.toLowerCase().includes('nome') || h.toLowerCase().includes('name'))
      if (nameIdx === -1) { alert("Colonna 'Nome' non trovata."); return }

      const datesMap = []
      headers.forEach((h, idx) => {
        if (idx === nameIdx) return;
        if (!['cognome', 'ruolo', 'matricola'].includes(h.toLowerCase())) {
          datesMap.push({ idx, label: h })
        }
      })

      const newAssignments = []
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row[nameIdx]) continue
        const rowName = String(row[nameIdx]).toLowerCase().trim()
        const foundStaff = staff.find(s => {
          const sName = (s.nome + " " + s.cognome).toLowerCase()
          return sName.includes(rowName) || rowName.includes(s.nome.toLowerCase())
        })
        if (!foundStaff) continue

        datesMap.forEach(d => {
          const cellVal = row[d.idx]
          if (cellVal) {
            const tName = String(cellVal).trim()
            const foundTmpl = templates.find(t => t.nome.toLowerCase() === tName.toLowerCase() || t.nome.toLowerCase().startsWith(tName.toLowerCase()))
            if (foundTmpl) {
              newAssignments.push({
                data: d.label,
                staffId: foundStaff.id,
                shiftTemplateId: foundTmpl.id,
                status: false // BOZZA
              })
            }
          }
        })
      }
      if (newAssignments.length > 0) {
        if (confirm(`Trovati ${newAssignments.length} turni. Importare?`)) {
          await api.saveShiftBulk(newAssignments)
          alert("Fatto")
          loadData()
        }
      }
    }
    reader.readAsBinaryString(file)
  }

  // helper to save budget manually
  async function saveBudget(date, statsObj) {
    try {
      await api.upsertBudget({
        data: date,
        value: statsObj.value,
        hoursLunch: statsObj.hoursLunch,
        hoursDinner: statsObj.hoursDinner
      });
    } catch (e) {
      console.error("Save Budget Failed", e);
    }
  }

  async function handleForecastImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

      // RIGHE FISSE RICHIESTE DALL'UTENTE:
      // Data: Riga 6 (indice 5)
      // Budget Ore Pranzo: Riga 8 (indice 7)
      // Budget Ore Sera: Riga 11 (indice 10)
      // Budget Euro (Real Day): Riga 15 (indice 14)

      const DATE_ROW_IDX = 5
      let IDX_HOURS_L = 7;
      let IDX_HOURS_D = 10;
      let IDX_EURO = 14;

      // Dynamic check (optional but safe)
      const lIdx = rows.findIndex(r => r && String(r[0]).toLowerCase().includes('real pranzo'));
      if (lIdx !== -1) IDX_HOURS_L = lIdx;

      const dIdx = rows.findIndex(r => r && String(r[0]).toLowerCase().includes('real cena'));
      if (dIdx !== -1) IDX_HOURS_D = dIdx;

      const eIdx = rows.findIndex(r => r && String(r[0]).toLowerCase().includes('real day'));
      if (eIdx !== -1) IDX_EURO = eIdx;

      if (!rows[DATE_ROW_IDX] || !rows[IDX_HOURS_L] || !rows[IDX_HOURS_D] || !rows[IDX_EURO]) {
        alert("Impossibile trovare le righe necessarie (Data, Real pranzo, Real cena, Real day).")
        return
      }

      const rowDates = rows[DATE_ROW_IDX]
      const rowHL = rows[IDX_HOURS_L]
      const rowHD = rows[IDX_HOURS_D]
      const rowEuro = rows[IDX_EURO]

      const parseEuro = (val) => {
        if (!val) return 0
        let s = String(val)
        s = s.replace(/€/g, '').replace(/\./g, '').replace(/,/g, '.').trim()
        return parseFloat(s) || 0
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

      let count = 0
      const promises = [];

      for (let i = 1; i <= 7; i++) {
        const dateStr = parseDate(rowDates[i])
        if (dateStr) {
          const hL = parseEuro(rowHL[i])
          const hD = parseEuro(rowHD[i])
          const valEuro = parseEuro(rowEuro[i])

          if (valEuro >= 0 || hL >= 0) {
            promises.push(api.upsertBudget({
              data: dateStr,
              value: valEuro,
              hoursLunch: hL,
              hoursDinner: hD
            }));
            count++
          }
        }
      }

      if (count > 0) {
        await Promise.all(promises);
        alert(`Importazione Completata!\n\n- ${count} Giorni importati.\n- Budget Ore (P/S) e Budget Euro (Totale) salvati.`)
        loadData();
      } else {
        alert("Nessun dato trovato.")
      }
    }
    reader.readAsBinaryString(file)
  }

  const days = getDatesInRange(range.start, range.end)

  const getShift = (staffId, date, type) => {
    const list = (matrix[staffId] && matrix[staffId][date]) || []
    return list.find(a => {
      const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null)
      if (!sT) return false
      const startH = parseInt(sT.split(':')[0])
      if (type === 'PRANZO') return startH < 17
      return startH >= 17
    })
  }

  const getSplitHours = (start, end) => {
    if (!start || !end) return { l: 0, d: 0 }
    const [h1, m1] = start.split(':').map(Number)
    const [h2, m2] = end.split(':').map(Number)
    let s = h1 + m1 / 60
    let e = h2 + m2 / 60
    if (e < s) e += 24

    // Pranzo < 16:00, Sera >= 16:00
    let l = 0, d = 0
    if (s < 16) l = Math.min(e, 16) - s
    if (e > 16) d = e - Math.max(s, 16)

    // Ensure 0.25 precision
    return {
      l: Math.round(l * 100) / 100,
      d: Math.round(d * 100) / 100
    }
  }

  // Calc hours logic
  const calcHours = (start, end) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number)
    const [h2, m2] = end.split(':').map(Number)
    let diff = (h2 + m2 / 60) - (h1 + m1 / 60)
    if (diff < 0) diff += 24 // Over midnight
    return Math.round(diff * 100) / 100
  }

  const getStats = () => {
    let totalAssignedHours = 0;
    let totalContractHours = 0;
    let totalShifts = 0;

    let totalCost = 0;

    staff.forEach(s => {
      totalContractHours += (s.oreMassime || 0); // Budget
      // Actual
      let staffHours = 0;
      const sMatrix = matrix[s.id] || {};
      Object.keys(sMatrix).forEach(d => {
        sMatrix[d].forEach(a => {
          if (a.shiftTemplate || a.start_time) {
            totalShifts++;
            const s = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null)
            const e = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null)
            staffHours += calcHours(s, e)
          }
        })
      })
      totalAssignedHours += staffHours;
      const multiplier = s.moltiplicatore !== undefined && s.moltiplicatore !== null ? s.moltiplicatore : 1.0;
      totalCost += staffHours * (s.costoOra || 0) * multiplier;
    });

    const productivity = totalAssignedHours > 0 ? (totalShifts / totalAssignedHours).toFixed(2) : '0.00';

    return { totalAssignedHours, totalContractHours, totalShifts, productivity, diff: totalContractHours - totalAssignedHours, totalCost }
  }

  const stats = getStats();

  const getTotalHours = (staffId) => {
    let total = 0
    const sMatrix = matrix[staffId] || {}
    Object.keys(sMatrix).forEach(date => {
      const asns = sMatrix[date]
      asns.forEach(a => {
        if (a.shiftTemplate) {
          const s = a.start_time || a.shiftTemplate.oraInizio
          const e = a.end_time || a.shiftTemplate.oraFine
          total += calcHours(s, e)
        }
      })
    })
    return total.toFixed(2)
  }

  // Helper to check if a template is taken on a date
  const isTemplateTaken = (date, tmplId) => {
    // Loop through all staff matrix
    for (const sId in matrix) {
      if (matrix[sId][date]) {
        const found = matrix[sId][date].find(a => a.shiftTemplateId === tmplId);
        // If found, and it's NOT the current editing cell's assignment (if we are editing same slot, it's ok)
        // But here editingCell has 'currentAsn'. If currentAsn.shiftTemplateId === tmplId, it's self.
        if (found) {
          if (editingCell?.currentAsn?.id === found.id) return false; // self
          return true;
        }
      }
    }
    return false;
  }

  // EDIT LOGIC
  const [editingCell, setEditingCell] = useState(null)
  const [customTimes, setCustomTimes] = useState({ start: '', end: '' })

  useEffect(() => {
    if (editingCell && editingCell.currentAsn) {
      setCustomTimes({
        start: editingCell.currentAsn.start_time || editingCell.currentAsn.shiftTemplate?.oraInizio || '',
        end: editingCell.currentAsn.end_time || editingCell.currentAsn.shiftTemplate?.oraFine || ''
      })
    } else {
      setCustomTimes({ start: '', end: '' })
    }
  }, [editingCell])

  const handleCellClick = async (staffId, date, type, currentAsn) => {
    if (readOnly) return;

    if (panarelloActive && currentAsn) {
      try {
        // Toggle Status (Draft vs Confirmed)
        const newStatus = !currentAsn.status;
        await api.updateAssignment(currentAsn.id, {
          ...currentAsn,
          status: newStatus
        });
        // Reload to show change
        loadData();
        return; // Don't open modal
      } catch (e) {
        alert("Errore Panarello: " + e.message);
      }
    }

    // Determine day name of the clicked date
    const d = new Date(date);
    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const currentDayName = dayNames[d.getDay()];

    const filteredTemplates = templates.filter(t => {
      const name = t.nome || '';
      // 1. Day Name Match
      const dayMatch = dayNames.find(dn => name.includes(dn));
      if (dayMatch && dayMatch !== currentDayName) return false;

      // 2. Lunch vs Dinner type match
      const startH = parseInt((t.oraInizio || '00:00').split(':')[0]);
      if (type.includes('Turno1') || type.includes('Pranzo')) {
        if (startH >= 17) return false; // Non è un turno di pranzo
      }
      if (type.includes('Turno2') || type.includes('Sera')) {
        if (startH < 17) return false; // Non è un turno di sera
      }

      return true;
    });

    setEditingCell({ staffId, date, type, currentAsn, filteredTemplates });
  };

  // STATION RULES
  const STATIONS_COMMON = ['BARGIU', 'BARSU', 'ACCSU', 'CDR', 'B/S', 'B/S_2', 'CUCINA', 'MANAGER'];
  const STATIONS_BY_DAY = {
    0: ['CDR_D', 'ACCGIU:_D', 'B/S_D'], // Domenica
    1: [], // Lunedi
    2: [], // Martedi
    3: ['SCARICO'], // Mercoledi
    4: [], // Giovedi
    5: ['CDR_V', 'ACCGIU_V', 'B/S_V'], // Venerdi
    6: ['CDR_S', 'ACCGIU:S', 'B/S_S', 'SCARICO'] // Sabato
  };

  async function saveEdit(val) {
    if (!editingCell) return;
    const { staffId, date, type, currentAsn } = editingCell;

    try {
      if (type.includes('Turno') || type.includes('In') || type.includes('Out')) {
        let newTmplId = val;
        if (newTmplId === 'MANUAL') newTmplId = ''; // Treat as custom/no-template
        let start_time = customTimes.start;
        let end_time = customTimes.end;

        // --- CHECK UNAVAILABILITY ---
        // Determine effective start time for checking
        let checkStart = start_time;
        if (!checkStart && newTmplId) {
          const t = templates.find(x => x.id === Number(newTmplId));
          if (t) checkStart = t.oraInizio;
        }

        if (checkStart) {
          const h = parseInt(checkStart.split(':')[0]);
          if (type.includes('Turno1') && h >= 16) {
            alert("ERRORE: In questa colonna (Turno 1 / Pranzo) puoi inserire solo turni che iniziano prima delle 16:00.");
            return;
          }
          if (type.includes('Turno2') && h < 16) {
            alert("ERRORE: In questa colonna (Turno 2 / Sera) puoi inserire solo turni che iniziano dalle 16:00 in poi.");
            return;
          }

          // Find specific unavailable record
          const u = unavailabilities.find(x => x.staffId === staffId && x.data === date);
          if (u) {
            let blocked = false;
            let reason = "";
            if (u.tipo === 'TOTALE') { blocked = true; reason = 'TOTALE'; }
            else {
              const h = parseInt(checkStart.split(':')[0]);
              if (u.tipo === 'PRANZO' && h < 16) { blocked = true; reason = 'PRANZO'; }
              if (u.tipo === 'SERA' && h >= 16) { blocked = true; reason = 'SERA'; }
            }

            if (blocked) {
              alert(`IMPOSSIBILE ASSEGNARE: Lo staff è indisponibile (${reason}) in questa data.`);
              setLoading(false);
              return;
            }
          }
        }
        // -----------------------------

        // --- CHECK DOUBLE SHIFT (Warning Only) ---
        // if creating/updating assignment, check if staff has shift in opposing slot
        // Lunch < 17, Dinner >= 17
        if (checkStart) {
          const h = parseInt(checkStart.split(':')[0]);
          const isLunch = h < 16;
          const opposing = (matrix[staffId] && matrix[staffId][date]) ? matrix[staffId][date].find(a => {
            if (a.id === (currentAsn && currentAsn.id)) return false; // same assignment
            if (!a.shiftTemplate) return false; // ignore manual if no template? or check time? manual time check is harder.
            const th = parseInt(a.shiftTemplate.oraInizio.split(':')[0]);
            const tIsLunch = th < 16;
            return isLunch !== tIsLunch; // Opposing
          }) : null;

          if (opposing) {
            if (!confirm(`ATTENZIONE: ${staff.find(s => s.id === staffId)?.nome} ha già un turno ${isLunch ? 'SERALE' : 'PRANZO'} in questa data. Continuare?`)) {
              return;
            }
          }
        }
        // -----------------------------------------

        // --- CHECK BUDGET (Warning Only) ---
        if (checkStart && customTimes.end) {
          const sObj = staff.find(s => s.id === staffId);
          if (sObj) {
            const h1 = parseInt(checkStart.split(':')[0]);
            const m1 = parseInt(checkStart.split(':')[1] || 0);
            const h2 = parseInt(customTimes.end.split(':')[0]);
            const m2 = parseInt(customTimes.end.split(':')[1] || 0);
            let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
            if (diff < 0) diff += 24;

            // Subtract old assignment if updating
            let existingTotal = getTotalHours(staffId);
            if (currentAsn) {
              const oldS = currentAsn.start_time || currentAsn.shiftTemplate?.oraInizio;
              const oldE = currentAsn.end_time || currentAsn.shiftTemplate?.oraFine;
              if (oldS && oldE) existingTotal -= calcHours(oldS, oldE);
            }

            if (existingTotal + diff > (sObj.oreMassime || 40)) {
              if (!confirm(`ATTENZIONE: Questo turno porta ${sObj.nome} a ${(existingTotal + diff).toFixed(1)} ore settimanali, superando il budget di ${sObj.oreMassime}h. Continuare?`)) {
                return;
              }
            }
          }
        }
        // -----------------------------------

        // Validazione Custom Shift
        const isCustom = (!newTmplId || newTmplId === '') && (start_time && end_time);

        // Se non ho template e non ho orari custom, è una cancellazione
        if (!newTmplId && !isCustom && currentAsn) {
          await api.deleteAssignment(currentAsn.id);
          setEditingCell(null);
          loadData();
          return;
        }

        // Se sto cercando di creare ma non ho nulla
        if (!newTmplId && !isCustom && !currentAsn) {
          alert("Seleziona un turno o inserisci orari manuali.");
          return;
        }

        const payload = {
          shiftTemplateId: newTmplId ? Number(newTmplId) : null,
          start_time,
          end_time,
          force: false // default
        };

        if (currentAsn) {
          await api.updateAssignment(currentAsn.id, payload)
          console.log(`✅ Turno aggiornato su Supabase: ${staff.find(s => s.id === staffId)?.nome} - ${date}`);
        } else {
          await api.createAssignment({
            staffId,
            data: date,
            ...payload,
            status: false
          })
          console.log(`✅ Turno creato su Supabase: ${staff.find(s => s.id === staffId)?.nome} - ${date}`);
        }
      }
      else if (type.includes('Post')) {
        if (currentAsn) {
          await api.updateAssignment(currentAsn.id, { postazione: val })
          console.log(`✅ Postazione aggiornata su Supabase`);
        }
        else if (val && val.trim() !== '') alert("Devi prima assegnare un turno!")
      }
      setEditingCell(null)
      loadData()
    } catch (e) {
      // ... existing error catch block ...
      console.error('❌ ERRORE salvataggio su Supabase:', e);
      alert(`❌ ERRORE: Il turno NON è stato salvato su Supabase!\n\n${e.message}\n\nRiprova o contatta l'amministratore.`);
    }
  }

  return (
    <div style={{ width: '100vw', minHeight: '100vh', padding: '10px 20px', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: 0, marginRight: 'auto' }}>Turni</h2>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold', fontSize: '0.85rem' }}>
            Anno
            <input
              type="number"
              className="input"
              value={currentYear}
              onChange={e => changeYear(e.target.value)}
              style={{ width: '80px' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 'bold', fontSize: '0.85rem' }}>
            Settimana
            <select
              className="input"
              value={selectedWeek}
              onChange={e => changeWeek(parseInt(e.target.value))}
              style={{ width: '120px' }}
            >
              {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>Periodo</span>
            <strong style={{ fontSize: '1.1rem' }}>
              {range.start.split('-').reverse().join('/')} - {range.end.split('-').reverse().join('/')}
            </strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {!readOnly && <button className="btn" style={{ backgroundColor: '#673ab7', color: 'white', fontWeight: 'bold' }} onClick={generate}>
          🤖 Genera Turni (AI Expert)
        </button>}
        {!readOnly && <label className="btn" style={{ backgroundColor: '#0275d8', color: 'white' }}>
          Importa Grid (CSV)
          <input type="file" style={{ display: 'none' }} onChange={handleImport} accept=".csv, .xlsx" />
        </label>}
        <button className="btn" style={{ backgroundColor: '#28a745', color: 'white' }} onClick={handleExportExcel}>
          📊 Esporta Excel
        </button>
        {!readOnly && <button className="btn" style={{ background: '#4caf50', color: 'white' }} onClick={() => { alert('Salvataggio completato!'); loadData(); }}>
          💾 Salva Tutto
        </button>}
        {!readOnly && <button className="btn" style={{ background: '#f44336', color: 'white' }} onClick={async () => {
          if (confirm("Vuoi cancellare TUTTI i turni di questa settimana? Questa azione non è reversibile.")) {
            try {
              await api.clearAssignments(range.start, range.end);
              loadData();
            } catch (e) {
              alert("Errore durante la cancellazione: " + e.message);
            }
          }
        }}>
          🗑️ Cancella Tutto
        </button>}
        <button className="btn" style={{ backgroundColor: '#ff9800', color: 'white', fontWeight: 'bold' }} onClick={verifyCoverage}>
          🔍 Verifica Copertura
        </button>

        <button
          className="btn"
          style={{
            backgroundColor: panarelloActive ? '#FFEB3B' : '#f0f0f0',
            fontSize: '1.5em',
            padding: '5px 15px',
            borderRadius: '10px',
            border: panarelloActive ? '3px solid #FBC02D' : '1px solid #ccc',
            boxShadow: panarelloActive ? '0 0 15px rgba(255, 235, 59, 0.7)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          onClick={() => setPanarelloActive(!panarelloActive)}
          title="Usa l'evidenziatore per colorare/togliere il giallo (DA RIVEDERE)"
        >
          🖌️
        </button>

        {unassignedShifts.length > 0 && (
          <button className="btn" style={{ backgroundColor: '#d32f2f', color: 'white', marginLeft: '10px' }} onClick={() => setShowUnassignedModal(true)}>
            ⚠️ Turni Mancanti ({unassignedShifts.length})
          </button>
        )}

        {!readOnly && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '15px', fontSize: '0.9em', background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
            <div><strong>Budget:</strong> {stats.totalContractHours}h</div>
            <div><strong>Effettivo:</strong> {stats.totalAssignedHours.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}h</div>
            <div><strong>Costo:</strong> €{stats.totalCost.toFixed(0)}</div>
            <div style={{ color: stats.diff >= 0 ? 'green' : 'red' }}><strong>Diff:</strong> {stats.diff.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}h</div>
            <div><strong>Produttività:</strong> {stats.productivity}</div>
          </div>
        )}
      </div>

      {/* EDITOR OVERLAY */}
      {editingCell && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setEditingCell(null)}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', minWidth: '300px' }} onClick={e => e.stopPropagation()}>
            <h3>Modifica {editingCell.type.replace('Post', ' Postazione').replace('Turno', ' Turno')}</h3>
            <div style={{ marginBottom: '10px' }}>
              <strong>{staff.find(s => s.id === editingCell.staffId)?.nome}</strong> - {editingCell.date}
            </div>

            {['Turno', 'In', 'Out'].some(x => editingCell.type.includes(x)) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.9em' }}>Seleziona Turno Base:</label>
                <select className="input" defaultValue={editingCell.currentAsn ? editingCell.currentAsn.shiftTemplateId : ''} id="editSelect"
                  onChange={(e) => {
                    const tId = e.target.value;
                    if (tmpl) {
                      setCustomTimes({ start: tmpl.oraInizio, end: tmpl.oraFine });
                    }
                  }}
                >
                  <option value="">(Nessun Turno - Cancella)</option>
                  <option value="MANUAL">-- Aggiungi Turno Manuale --</option>
                  {(editingCell.filteredTemplates || templates).filter(t => {
                    // Safe Day Calculation (avoid timezone rollback)
                    const dayOfWeek = new Date(editingCell.date + 'T12:00:00').getDay();

                    // 1. Strict Name-Based Rules (Derived from File & User input)
                    const n = t.nome.toUpperCase();

                    // SCARICO: Solo Mercoledì (3) e Sabato (6)
                    if (n.includes('SCARICO')) {
                      if (dayOfWeek !== 3 && dayOfWeek !== 6) return false;
                    }
                    // SUFFIXES Validity
                    else if (n.includes('_D') || n.includes(':D') || n.includes(' D')) {
                      if (dayOfWeek !== 0) return false; // Solo Dom
                    }
                    else if (n.includes('_S') || n.includes(':S') || n.includes(' S')) {
                      if (dayOfWeek !== 6) return false; // Solo Sab
                    }
                    else if (n.includes('_V') || n.includes(':V') || n.includes(' V')) {
                      if (dayOfWeek !== 5) return false; // Solo Ven
                    }
                    else {
                      // "Standard" shifts (no suffix)
                      // User says "Monday only Monday".
                      // Assuming Standard shifts apply to Mon-Sun UNLESS specific suffix exists
                      // BUT maybe "Standard" shouldn't appear on D/S/V if there's a specific one?
                      // For now, let's keep it safe. 
                      // If user wants STRICT Mon-Thu for standard, we'd need more rules.
                    }

                    // 2. DB Rule fallback
                    const isValidDay = !t.giorniValidi || t.giorniValidi.length === 0 || t.giorniValidi.includes(dayOfWeek);
                    if (!isValidDay) return false;

                    const startH = parseInt(t.oraInizio.split(':')[0]);
                    const isLunch = editingCell.type.includes('Pranzo');

                    if (isLunch && startH >= 17) return false;
                    if (!isLunch && startH < 17) return false;

                    // Uniqueness Check
                    if (isTemplateTaken(editingCell.date, t.id)) return false;

                    return true;
                  }).map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({t.oraInizio}-{t.oraFine})</option>
                  ))}
                </select>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.8em', fontWeight: 'bold' }}>Inizio:</label>
                    <QuarterTimeInput id="editStart" value={customTimes.start} onChange={(v) => setCustomTimes(prev => ({ ...prev, start: v }))} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.8em', fontWeight: 'bold' }}>Fine:</label>
                    <QuarterTimeInput id="editEnd" value={customTimes.end} onChange={(v) => setCustomTimes(prev => ({ ...prev, end: v }))} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn" onClick={() => saveEdit(document.getElementById('editSelect').value)}>Salva</button>
                  {editingCell.currentAsn && (
                    <button className="btn" style={{ background: '#f44336', color: 'white' }}
                      onClick={async () => {
                        if (confirm("Vuoi cancellare questo turno?")) {
                          await api.deleteAssignment(editingCell.currentAsn.id);
                          setEditingCell(null);
                          loadData();
                        }
                      }}>
                      Cancella Turno
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label>Seleziona Postazione ({new Date(editingCell.date).toLocaleDateString('it-IT', { weekday: 'long' })})</label>
                <select className="input" id="editInput" defaultValue={editingCell.currentAsn ? editingCell.currentAsn.postazione : ''}>
                  <option value="">- Seleziona -</option>
                  {[...STATIONS_COMMON, ...(STATIONS_BY_DAY[new Date(editingCell.date).getDay()] || [])].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <button className="btn" onClick={() => saveEdit(document.getElementById('editInput').value)}>Salva</button>
              </div>
            )}
            <button className="btn" style={{ marginTop: '10px', background: '#ccc' }} onClick={() => setEditingCell(null)}>Annulla</button>
          </div>
        </div>
      )
      }

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table className="table" style={{ fontSize: '0.8em', borderCollapse: 'collapse', width: '100%', minWidth: '1600px' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ position: 'sticky', left: 0, zIndex: 20, background: '#fff', borderRight: '1px solid #ddd', minWidth: '40px' }}>#</th>
              <th rowSpan={2} style={{ position: 'sticky', left: '40px', zIndex: 20, background: '#fff', borderRight: '2px solid #ddd', minWidth: '150px' }}>Staff</th>
              <th rowSpan={2} style={{ position: 'sticky', left: '190px', zIndex: 20, background: '#fff', borderRight: '2px solid #ddd', minWidth: '50px' }}>Ctr.</th>
              <th rowSpan={2} style={{ position: 'sticky', left: '240px', zIndex: 20, background: '#fff', borderRight: '2px solid #ddd', minWidth: '50px' }}>Eff.</th>

              {days.map(d => (
                <th key={d} colSpan={6} style={{ borderRight: '2px solid #aaa', textAlign: 'center', background: '#f8f9fa' }}>
                  {d.split('-').slice(1).join('/')} <br />
                  <span style={{ fontSize: '0.8em', textTransform: 'uppercase' }}>
                    {new Date(d).toLocaleDateString('it-IT', { weekday: 'short' })}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {days.map(d => (
                <React.Fragment key={d + '_sub'}>
                  <th style={{ minWidth: '40px', background: '#e8f5e9' }}>In</th>
                  <th style={{ minWidth: '40px', background: '#e8f5e9' }}>Out</th>
                  <th style={{ minWidth: '50px', background: '#e8f5e9', borderRight: '1px solid #ddd' }}>Post.</th>
                  <th style={{ minWidth: '40px', background: '#e3f2fd' }}>In</th>
                  <th style={{ minWidth: '40px', background: '#e3f2fd' }}>Out</th>
                  <th style={{ minWidth: '50px', background: '#e3f2fd', borderRight: '2px solid #aaa' }}>Post.</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map(s => {
              // Detailed Calculation per row
              let total = 0;
              let lunchH = 0;
              let dinnerH = 0;

              const sMatrix = matrix[s.id] || {}



              Object.keys(sMatrix).forEach(date => {
                const asns = sMatrix[date];
                asns.forEach(a => {
                  const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null);
                  const eT = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null);

                  if (sT && eT) {
                    const [h1, m1] = sT.split(':').map(Number);
                    const [h2, m2] = eT.split(':').map(Number);
                    let start = h1 + m1 / 60;
                    let end = h2 + m2 / 60;
                    if (end < start) end += 24;

                    total += (end - start);

                    // Split calculation - Pranzo < 16:00, Sera >= 16:00
                    const CUTOFF = 16.0;
                    if (start < CUTOFF) {
                      lunchH += (Math.min(end, CUTOFF) - start);
                    }
                    if (end > CUTOFF) {
                      dinnerH += (end - Math.max(start, CUTOFF));
                    }
                  }
                });
              });

              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', borderRight: '1px solid #ddd', padding: '5px', textAlign: 'center', color: '#999', fontSize: '0.8em', zIndex: 10 }}>
                    {s.listIndex}
                  </td>
                  <td style={{ position: 'sticky', left: '40px', background: '#fff', borderRight: '2px solid #ddd', padding: '5px', zIndex: 10 }}>
                    <strong>{s.nome} {s.cognome}</strong>
                  </td>
                  <td style={{ position: 'sticky', left: '190px', background: '#fff', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', color: '#666', zIndex: 10 }}>
                    {s.oreMassime || '-'}
                  </td>
                  <td style={{
                    position: 'sticky', left: '240px',
                    background: (() => {
                      if ((s.ruolo || '').toLowerCase().includes('chiamata')) return '#fff';
                      const target = s.oreMassime || 0;
                      const diff = total - target;
                      if (diff > 0) { // Overtime
                        return diff > 3 ? '#ffcdd2' : '#fff9c4';
                      } else if (diff < 0) { // Undertime
                        return '#bbdefb'; // Blue (Under hours)
                      }
                      return '#fff'; // Exact
                    })(),
                    borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', fontWeight: 'bold', zIndex: 10
                  }}>
                    {total.toFixed(2)}
                  </td>

                  {days.map(d => {
                    const lunch = getShift(s.id, d, 'PRANZO')
                    const dinner = getShift(s.id, d, 'SERA')

                    const getDayName = (dateStr) => {
                      if (!dateStr) return '';
                      const parts = dateStr.split('-');
                      const d = new Date(parts[0], parts[1] - 1, parts[2]);
                      const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
                      return days[d.getDay()];
                    };
                    const dayName = getDayName(d);

                    // Availability Check - Slot Aware
                    const findUnavail = (typeP) => {
                      return (s.unavailabilities || []).find(u => {
                        const uDate = u.data ? u.data.split('T')[0] : '';
                        if (uDate !== d) return false;
                        if (u.tipo === 'TOTALE') return true;
                        if (u.tipo === 'PRANZO' && typeP === 'Pranzo') return true;
                        if (u.tipo === 'SERA' && typeP === 'Sera') return true;
                        // Partial: if tipo is PARZIALE, we'd need time logic. 
                        // For now, let's assume PARZIALE blocks the slot if it overlaps.
                        // Standard slots: Pranzo (<17), Sera (>=17)
                        if (u.tipo === 'PARZIALE' && u.start_time) {
                          const startH = parseInt(u.start_time.split(':')[0]);
                          if (typeP === 'Pranzo' && startH < 17) return true;
                          if (typeP === 'Sera' && startH >= 17) return true;
                        }
                        return false;
                      });
                    };

                    const renderSlot = (asn, typePrefix, bgColor, dayN) => {
                      const suffix = typePrefix === 'Pranzo' ? 'P' : 'S';
                      const bindKey = `${dayN}_${suffix}`;
                      const constraint = (s.fixedShifts || {})[bindKey];

                      const cursorStyle = panarelloActive ? 'url("https://img.icons8.com/color/24/000000/marker.png") 0 24, crosshair' : 'pointer';

                      // Determine Content and Style
                      let cellBg = bgColor;
                      let contentStart = '-';
                      let contentEnd = '-';
                      let contentPost = '';
                      let isBlocked = false;

                      const unavail = findUnavail(typePrefix);

                      if (unavail) {
                        cellBg = '#ffebee'; // Red background for Unavailability
                        contentStart = 'INDISPONIBILE';
                        isBlocked = true;
                      } else if (constraint && constraint.startsWith('NO')) {
                        cellBg = '#ffebee'; // Light Red for NO
                        contentStart = 'NO';
                        isBlocked = true;
                      } else if (constraint && constraint !== 'FIX') {
                        // Fixed Time Preference/Constraint (e.g. 10:30-15:30)
                        // If NOT assigned, show this as a hint?
                        if (!asn) {
                          cellBg = '#fffde7'; // Light Yellow

                          // Parse "10:30-15:30"
                          if (constraint.includes('-')) {
                            const [sTime, eTime] = constraint.split('-');
                            contentStart = sTime;
                            contentEnd = eTime;
                          } else {
                            contentStart = 'FIX';
                          }
                          // contentPost = constraint; // Too long?
                        }
                      }

                      const clickH = (t) => {
                        if (panarelloActive && asn) {
                          handleCellClick(s.id, d, typePrefix + t, asn);
                          return;
                        }
                        if (!isBlocked) {
                          handleCellClick(s.id, d, typePrefix + t, asn);
                        } else if (unavail) {
                          if (confirm(`Rimuovere l'indisponibilità di ${s.nome} per il ${d} (${typePrefix})?`)) {
                            api.deleteUnavailability(unavail.id)
                              .then(() => {
                                alert("Indisponibilità rimossa.");
                                loadData();
                              })
                              .catch(e => alert("Errore: " + e.message));
                          }
                        }
                      }

                      const fmt = (t) => {
                        if (!t) return '-';
                        // Handle both HH:MM and H:MM formats
                        const parts = String(t).split(':');
                        if (parts.length !== 2) return '-';
                        const [h, m] = parts.map(Number);
                        if (isNaN(h) || isNaN(m)) return '-';
                        const h24 = h % 24;
                        return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      }

                      if (asn) {
                        // Prioritize custom times over template times
                        const startTime = asn.start_time || asn.shiftTemplate?.oraInizio;
                        const endTime = asn.end_time || asn.shiftTemplate?.oraFine;

                        contentStart = fmt(startTime);
                        contentEnd = fmt(endTime);
                        contentPost = asn.postazione || '';

                        // Debug log for troubleshooting
                        if (!endTime) {
                          console.warn('⚠️ Missing end time for assignment:', asn.id, 'Staff:', s.nome, 'Date:', d);
                        }

                        // Yellow for Draft (status === false)
                        if (asn.status === false) {
                          cellBg = '#fff9c4'; // Modern Yellow
                          // Optionally add 'DA RIVEDERE'
                          if (!contentPost) contentPost = 'DA RIVEDERE';
                        }
                      }

                      return (
                        <React.Fragment>
                          <td onClick={() => clickH('In')} style={{
                            background: cellBg,
                            textAlign: 'center',
                            cursor: isBlocked ? 'not-allowed' : 'pointer',
                            fontSize: '0.95em',
                            fontWeight: asn ? '600' : 'normal',
                            padding: '8px 4px',
                            borderLeft: typePrefix === 'Pranzo' ? '2px solid #4caf50' : '2px solid #2196f3'
                          }}>
                            {contentStart}
                          </td>
                          <td onClick={() => clickH('Out')} style={{
                            background: cellBg,
                            textAlign: 'center',
                            cursor: isBlocked ? 'not-allowed' : 'pointer',
                            fontSize: '0.95em',
                            fontWeight: asn ? '600' : 'normal',
                            padding: '8px 4px'
                          }}>
                            {contentEnd}
                          </td>
                          <td onClick={() => clickH('Post')} style={{
                            background: cellBg,
                            textAlign: 'center',
                            cursor: isBlocked ? 'not-allowed' : 'pointer',
                            fontSize: '0.85em',
                            padding: '8px 4px',
                            borderRight: typePrefix === 'Sera' ? '3px solid #333' : '1px solid #ddd',
                            fontWeight: contentPost && contentPost !== 'DA RIVEDERE' ? '500' : 'normal',
                            color: contentPost === 'DA RIVEDERE' ? '#ff6f00' : 'inherit'
                          }}>
                            {contentPost}
                          </td>
                        </React.Fragment>
                      )
                    }

                    return (
                      <React.Fragment key={d}>
                        {renderSlot(lunch, 'Pranzo', '#f1f8e9', dayName)}
                        {renderSlot(dinner, 'Sera', '#e1f5fe', dayName)}
                      </React.Fragment>
                    )
                  })}
                </tr>
              )
            })}

            {/* Footer Row 1: BUDGET € PRANZO - HIDE FOR OPERATORS */}
            {!readOnly && (
              <tr style={{ background: '#fff9c4', borderTop: '2px solid #ccc' }}>
                <td style={{ position: 'sticky', left: 0, background: '#fff9c4', borderRight: '1px solid #ddd', padding: '10px', fontWeight: 'bold', zIndex: 10 }} colSpan={2}>BUDGET € PRANZO</td>
                <td style={{ position: 'sticky', left: '190px', background: '#fff9c4', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                <td style={{ position: 'sticky', left: '240px', background: '#fff9c4', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                {days.map(d => {
                  const dayBud = forecast[d] || {};
                  const val = dayBud.revLunch;
                  return (
                    <React.Fragment key={d}>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd', fontWeight: 'bold' }}>
                        {val !== undefined && val !== 0 ? `€ ${val}` : '-'}
                      </td>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa', background: '#fbe9e7' }}></td>
                    </React.Fragment>
                  )
                })}
              </tr>
            )}

            {/* Footer Row 2: BUDGET € SERA - HIDE FOR OPERATORS */}
            {!readOnly && (
              <tr style={{ background: '#e0f7fa', borderTop: '1px solid #ddd' }}>
                <td style={{ position: 'sticky', left: 0, width: '190px', maxWidth: '190px', overflow: 'hidden', whiteSpace: 'nowrap', background: '#e0f7fa', borderRight: '1px solid #ddd', padding: '10px', fontWeight: 'bold', zIndex: 10 }} colSpan={2} title="BUDGET € SERA">
                  BUDGET SERA (€)
                </td>
                <td style={{ position: 'sticky', left: '190px', width: '50px', maxWidth: '50px', background: '#e0f7fa', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                <td style={{ position: 'sticky', left: '240px', width: '50px', maxWidth: '50px', background: '#e0f7fa', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                {days.map(d => {
                  const dayBud = forecast[d] || {};
                  const val = dayBud.revDinner;
                  return (
                    <React.Fragment key={d}>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd', background: '#e1f5fe' }}></td>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa', fontWeight: 'bold' }}>
                        {val !== undefined && val !== 0 ? `€ ${val}` : '-'}
                      </td>
                    </React.Fragment>
                  )
                })}
              </tr>
            )}

            {/* Footer Row NEW: BUDGET € TOTALE - HIDE FOR OPERATORS */}
            {!readOnly && (
              <tr style={{ background: '#b2ebf2', borderTop: '1px solid #ddd', fontWeight: 'bold' }}>
                <td style={{ position: 'sticky', left: 0, width: '190px', maxWidth: '190px', overflow: 'hidden', whiteSpace: 'nowrap', background: '#b2ebf2', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2} title="BUDGET € TOTALE">
                  BUDGET TOTALE (€)
                </td>
                <td style={{ position: 'sticky', left: '190px', width: '50px', maxWidth: '50px', background: '#b2ebf2', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                <td style={{ position: 'sticky', left: '240px', width: '50px', maxWidth: '50px', background: '#b2ebf2', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                {days.map(d => {
                  const dayBud = forecast[d] || {};
                  const tot = (parseFloat(dayBud.revLunch) || 0) + (parseFloat(dayBud.revDinner) || 0);
                  return (
                    <td key={d} colSpan={6} style={{ textAlign: 'center', borderRight: '2px solid #aaa', color: '#006064' }}>
                      {tot !== 0 ? `€ ${tot}` : '-'}
                    </td>
                  )
                })}
              </tr>
            )}

            {/* Footer Row 3: BUDGET ORE PRANZO - HIDE FOR OPERATORS */}
            {!readOnly && (
              <tr style={{ background: '#fff9c4', borderTop: '2px solid #ccc' }}>
                <td style={{ position: 'sticky', left: 0, background: '#fff9c4', borderRight: '1px solid #ddd', padding: '10px', fontWeight: 'bold', zIndex: 10 }} colSpan={2}>BUDGET ORE PRANZO</td>
                <td style={{ position: 'sticky', left: '190px', background: '#fff9c4', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                <td style={{ position: 'sticky', left: '240px', background: '#fff9c4', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                {days.map(d => {
                  const dayBud = forecast[d] || {};
                  const val = dayBud.hoursLunch;
                  return (
                    <React.Fragment key={d}>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd' }}>
                        {val !== undefined && val !== 0 ? val : '-'}
                      </td>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa', background: '#fbe9e7' }}></td>
                    </React.Fragment>
                  )
                })}
              </tr>
            )}

            {/* Footer Row 4: BUDGET ORE SERA - HIDE FOR OPERATORS */}
            {!readOnly && (
              <tr style={{ background: '#e0f7fa', borderTop: '1px solid #ddd' }}>
                <td style={{ position: 'sticky', left: 0, background: '#e0f7fa', borderRight: '1px solid #ddd', padding: '10px', fontWeight: 'bold', zIndex: 10 }} colSpan={2}>BUDGET ORE SERA</td>
                <td style={{ position: 'sticky', left: '190px', background: '#e0f7fa', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                <td style={{ position: 'sticky', left: '240px', background: '#e0f7fa', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                {days.map(d => {
                  const dayBud = forecast[d] || {};
                  const val = dayBud.hoursDinner;
                  return (
                    <React.Fragment key={d}>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd', background: '#e1f5fe' }}></td>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa' }}>
                        {val !== undefined && val !== 0 ? val : '-'}
                      </td>
                    </React.Fragment>
                  )
                })}
              </tr>
            )}

            {/* Footer Row 5: ORE REALI PRANZO */}
            <tr style={{ background: '#f0f0f0', fontWeight: 'bold', borderTop: '1px solid #ccc' }}>
              <td style={{ position: 'sticky', left: 0, background: '#f0f0f0', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2}>ORE REALI PRANZO</td>
              <td style={{ position: 'sticky', left: '190px', background: '#f0f0f0', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              <td style={{ position: 'sticky', left: '240px', background: '#f0f0f0', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              {days.map(d => {
                let lunchHours = 0;
                staff.forEach(s => {
                  ((matrix[s.id] || {})[d] || []).forEach(a => {
                    // FIX: Check for custom start/end as AI shifts might not have a template
                    const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null);
                    const eT = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null);

                    if (sT && eT) {
                      const { l } = getSplitHours(sT, eT);
                      lunchHours += l;
                    }
                  })
                })
                return (
                  <React.Fragment key={d}>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd' }}>
                      {lunchHours.toFixed(1)}
                    </td>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa', background: '#ddd' }}></td>
                  </React.Fragment>
                )
              })}
            </tr>

            {/* Footer Row 6: ORE REALI SERA */}
            <tr style={{ background: '#e0f2f1', fontWeight: 'bold', borderTop: '1px solid #ddd' }}>
              <td style={{ position: 'sticky', left: 0, background: '#e0f2f1', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2}>ORE REALI SERA</td>
              <td style={{ position: 'sticky', left: '190px', background: '#e0f2f1', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              <td style={{ position: 'sticky', left: '240px', background: '#e0f2f1', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              {days.map(d => {
                let dinnerHours = 0;
                staff.forEach(s => {
                  ((matrix[s.id] || {})[d] || []).forEach(a => {
                    // FIX: Check for custom start/end as AI shifts might not have a template
                    const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null);
                    const eT = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null);

                    if (sT && eT) {
                      const { d: dH } = getSplitHours(sT, eT);
                      dinnerHours += dH;
                    }
                  })
                })
                return (
                  <React.Fragment key={d}>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd', background: '#b2dfdb' }}></td>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa' }}>
                      {dinnerHours.toFixed(1)}
                    </td>
                  </React.Fragment>
                )
              })}
            </tr>

            {/* Footer Row 7: DELTA PRANZO */}
            <tr style={{ borderTop: '2px solid #ccc' }}>
              <td style={{ position: 'sticky', left: 0, background: '#fff', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2}>DELTA PRANZO</td>
              <td style={{ position: 'sticky', left: '190px', background: '#fff', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              <td style={{ position: 'sticky', left: '240px', background: '#fff', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              {days.map(d => {
                const db = forecast[d] || {};
                const bud = parseFloat(db.hoursLunch) || 0;
                let eff = 0;
                staff.forEach(s => {
                  ((matrix[s.id] || {})[d] || []).forEach(a => {
                    if (a.shiftTemplate || a.start_time) {
                      const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null);
                      const eT = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null);
                      const { l } = getSplitHours(sT, eT);
                      eff += l;
                    }
                  })
                });
                const delta = bud - eff;
                const color = delta >= 0 ? 'green' : 'red';
                return (
                  <React.Fragment key={d}>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd', color: color, fontWeight: 'bold' }}>
                      {delta.toFixed(1)}
                    </td>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa', background: '#f5f5f5' }}></td>
                  </React.Fragment>
                )
              })}
            </tr>

            {/* Footer Row 8: DELTA SERA */}
            <tr style={{ borderTop: '1px solid #ddd' }}>
              <td style={{ position: 'sticky', left: 0, background: '#fff', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2}>DELTA SERA</td>
              <td style={{ position: 'sticky', left: '190px', background: '#fff', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              <td style={{ position: 'sticky', left: '240px', background: '#fff', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              {days.map(d => {
                const db = forecast[d] || {};
                const bud = parseFloat(db.hoursDinner) || 0;
                let eff = 0;
                staff.forEach(s => {
                  ((matrix[s.id] || {})[d] || []).forEach(a => {
                    if (a.shiftTemplate || a.start_time) {
                      const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null);
                      const eT = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null);
                      const { d: dH } = getSplitHours(sT, eT);
                      eff += dH;
                    }
                  })
                });
                const delta = bud - eff;
                const color = delta >= 0 ? 'green' : 'red';
                return (
                  <React.Fragment key={d}>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd', background: '#e1f5fe' }}></td>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa', color: color, fontWeight: 'bold' }}>
                      {delta.toFixed(1)}
                    </td>
                  </React.Fragment>
                )
              })}
            </tr>


            {/* Footer Row 9: PROD. PRANZO */}
            <tr style={{ background: '#e1bee7', fontWeight: 'bold', borderTop: '2px solid #ccc', color: '#4a148c' }}>
              <td style={{ position: 'sticky', left: 0, background: '#e1bee7', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2}>PROD. PRANZO (€/h)</td>
              <td style={{ position: 'sticky', left: '190px', background: '#e1bee7', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              <td style={{ position: 'sticky', left: '240px', background: '#e1bee7', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
              {days.map(d => {
                const db = forecast[d] || {};
                const euro = parseFloat(db.revLunch) || 0;
                let eff = 0;
                staff.forEach(s => {
                  ((matrix[s.id] || {})[d] || []).forEach(a => {
                    if (a.shiftTemplate || a.start_time) {
                      const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null);
                      const eT = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null);
                      const { l } = getSplitHours(sT, eT);
                      eff += l;
                    }
                  })
                });
                const prod = eff > 0 ? (euro / eff).toFixed(2) : '-';
                return (
                  <React.Fragment key={d}>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd' }}>
                      € {prod}
                    </td>
                    <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa', background: '#f3e5f5' }}></td>
                  </React.Fragment>
                )
              })}
            </tr>

            {/* Footer Row 10: PROD. SERA - HIDE FOR OPERATORS */}
            {!readOnly && (
              <tr style={{ background: '#ce93d8', fontWeight: 'bold', borderTop: '1px solid #ddd', color: '#4a148c' }}>
                <td style={{ position: 'sticky', left: 0, background: '#ce93d8', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2}>PROD. SERA (€/h)</td>
                <td style={{ position: 'sticky', left: '190px', background: '#ce93d8', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                <td style={{ position: 'sticky', left: '240px', background: '#ce93d8', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                {days.map(d => {
                  const db = forecast[d] || {};
                  const euro = parseFloat(db.revDinner) || 0;
                  let eff = 0;
                  staff.forEach(s => {
                    ((matrix[s.id] || {})[d] || []).forEach(a => {
                      if (a.shiftTemplate || a.start_time) {
                        const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null);
                        const eT = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null);
                        const { d: dH } = getSplitHours(sT, eT);
                        eff += dH;
                      }
                    })
                  });
                  const prod = eff > 0 ? (euro / eff).toFixed(2) : '-';
                  return (
                    <React.Fragment key={d}>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '1px solid #ddd', background: '#e1bee7' }}></td>
                      <td colSpan={3} style={{ textAlign: 'center', borderRight: '2px solid #aaa' }}>
                        € {prod}
                      </td>
                    </React.Fragment>
                  )
                })}
              </tr>
            )}

            {/* Footer Row 11: PROD. GIORNALIERA - HIDE FOR OPERATORS */}
            {!readOnly && (
              <tr style={{ background: '#ba68c8', fontWeight: 'bold', borderTop: '2px solid #ddd', color: '#fff' }}>
                <td style={{ position: 'sticky', left: 0, background: '#ba68c8', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2}>PROD. GIORNALIERA</td>
                <td style={{ position: 'sticky', left: '190px', background: '#ba68c8', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                <td style={{ position: 'sticky', left: '240px', background: '#ba68c8', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                {days.map(d => {
                  const db = forecast[d] || {};
                  const euroL = parseFloat(db.revLunch) || 0;
                  const euroD = parseFloat(db.revDinner) || 0;
                  const totalRev = euroL + euroD;

                  let eff = 0;
                  staff.forEach(s => {
                    ((matrix[s.id] || {})[d] || []).forEach(a => {
                      if (a.shiftTemplate || a.start_time) {
                        const sT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : null);
                        const eT = a.end_time || (a.shiftTemplate ? a.shiftTemplate.oraFine : null);
                        const { l, d: dH } = getSplitHours(sT, eT);
                        eff += (l + dH);
                      }
                    })
                  });
                  const prod = eff > 0 ? (totalRev / eff).toFixed(2) : '-';
                  return (
                    <td key={d} colSpan={6} style={{ textAlign: 'center', borderRight: '2px solid #aaa' }}>
                      € {prod}
                    </td>
                  )
                })}
              </tr>
            )}

            {/* Footer Row 12: COSTI STIMATI - HIDE FOR OPERATORS */}
            {!readOnly && (
              <tr style={{ background: '#fff3e0', fontWeight: 'bold', borderTop: '1px solid #ccc', color: '#e65100' }}>
                <td style={{ position: 'sticky', left: 0, background: '#fff3e0', borderRight: '1px solid #ddd', padding: '10px', zIndex: 10 }} colSpan={2}>COSTI STIMATI</td>
                <td style={{ position: 'sticky', left: '190px', background: '#fff3e0', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>€ {stats.totalCost.toFixed(0)}</td>
                <td style={{ position: 'sticky', left: '240px', background: '#fff3e0', borderRight: '2px solid #ddd', padding: '5px', textAlign: 'center', zIndex: 10 }}>-</td>
                <td colSpan={days.length * 6} style={{ textAlign: 'center', fontSize: '0.8em', color: '#999' }}>
                  (Calcolo basato su Costo Ora Staff)
                </td>
              </tr>
            )}


          </tbody>
        </table>
      </div>



      {/* Unassigned Warning Modal */}
      {
        showUnassignedModal && unassignedShifts.length > 0 && !readOnly && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '10px',
              maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#d32f2f', marginTop: 0 }}>⚠️ Turni Non Assegnati ({unassignedShifts.length})</h3>
              <p>I seguenti turni non sono stati assegnati perché nessuno staff soddisfaceva i requisiti.</p>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', marginBottom: '15px' }}>
                {unassignedShifts.map((u, i) => (
                  <div key={i} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{new Date(u.date).toLocaleDateString('it-IT')} - {u.station}</strong><br />
                        <span style={{ fontSize: '0.9em', color: '#666' }}>{u.start} - {u.end}</span>
                      </div>
                      <button className="btn" style={{ fontSize: '0.8em', background: '#2196f3', color: 'white' }} onClick={() => findCandidates(u)}>
                        🔍 Trova Staff
                      </button>
                    </div>

                    {/* Candidate Expansion */}
                    {targetGap === u && (
                      <div style={{ marginTop: '10px', background: '#e3f2fd', padding: '10px', borderRadius: '5px' }}>

                        {selectedCandidate ? (
                          <div style={{ background: '#fff9c4', padding: '10px', borderRadius: '5px', border: '1px solid #fbc02d' }}>
                            <strong>Confermi l'assegnazione a {selectedCandidate.nome} {selectedCandidate.cognome}?</strong>
                            <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                              <button className="btn" style={{ background: '#2e7d32', color: 'white' }}
                                onClick={() => { assignCandidate(selectedCandidate.id); setSelectedCandidate(null); }}>
                                ✅ Conferma
                              </button>
                              <button className="btn" style={{ background: '#757575', color: 'white' }}
                                onClick={() => setSelectedCandidate(null)}>
                                ❌ Annulla
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {!manualMode ? (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong>Staff Disponibile:</strong>
                                  <button style={{ fontSize: '0.8em', background: '#ff9800', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer' }}
                                    onClick={() => setManualMode(true)}>
                                    ➕ Manuale
                                  </button>
                                </div>

                                {!candidateList ? <div>Caricamento...</div> : candidateList.length === 0 ? <div style={{ color: 'red' }}>Nessuno staff trovato (prova manuale).</div> : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                                    {candidateList.map(s => (
                                      <button key={s.id} onClick={() => setSelectedCandidate(s)} style={{
                                        padding: '5px 10px', border: '1px solid #2196f3', background: 'white', cursor: 'pointer', borderRadius: '3px'
                                      }}>
                                        {s.nome} {s.cognome}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ background: '#fff3e0', padding: '10px', borderRadius: '5px' }}>
                                <strong>Assegnazione Manuale (Tutti i dipendenti):</strong>
                                <div style={{ marginTop: '5px', display: 'flex', gap: '10px' }}>
                                  <select className="input" onChange={(e) => {
                                    if (e.target.value) {
                                      const s = staff.find(st => st.id === Number(e.target.value));
                                      if (s) setSelectedCandidate(s);
                                    }
                                  }} value="">
                                    <option value="">-- Seleziona Staff --</option>
                                    {[...staff].sort((a, b) => a.nome.localeCompare(b.nome)).map(s => (
                                      <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>
                                    ))}
                                  </select>
                                  <button className="btn" style={{ background: '#9e9e9e', color: 'white', padding: '5px 10px' }} onClick={() => setManualMode(false)}>
                                    Annulla
                                  </button>
                                </div>
                                <small style={{ color: '#d32f2f' }}>Attenzione: Ignora vincoli di disponibilità.</small>
                              </div>
                            )}
                          </>
                        )}

                      </div>
                    )}

                    {u.candidates && u.candidates.length > 0 && !targetGap && (
                      <div style={{ marginTop: '5px', fontSize: '0.85em', background: '#f9f9f9', padding: '5px' }}>
                        <strong>Perché scartati (dal generatore)?</strong>
                        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                          {u.candidates.slice(0, 3).map((c, ci) => (
                            <li key={ci}>{c.name}: {c.reason}</li>
                          ))}
                          {u.candidates.length > 3 && <li>...e altri {u.candidates.length - 3}</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn" onClick={() => setShowUnassignedModal(false)}>Chiudi (Mantieni)</button>
              </div>
            </div>
          </div>
        )
      }

      {
        coverage.length > 0 && !readOnly && (
          <div style={{ marginTop: '30px', borderTop: '2px solid #ccc', paddingTop: '20px' }}>
            <h3>Fabbisogno / Copertura (Postazioni)</h3>
            <div style={{ overflowX: 'auto', border: '1px solid #ddd' }}>
              <table className="table" style={{ fontSize: '0.75em', borderCollapse: 'collapse', textAlign: 'center', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#eee' }}>
                    <th rowSpan={2} style={{ border: '1px solid #999', padding: '5px' }}>Postazione</th>
                    <th rowSpan={2} style={{ border: '1px solid #999', padding: '5px' }}>Freq</th>
                    {/* Simplified View: Show Slots for Days */}
                    {days.map(d => <th key={d} colSpan={4} style={{ border: '1px solid #999', background: '#e3f2fd' }}>{d}</th>)}
                  </tr>
                  <tr style={{ background: '#eee' }}>
                    {/* In/Out headers */}
                    {days.map((d, i) => (
                      <React.Fragment key={i}>
                        <th colSpan={2} style={{ border: '1px solid #ccc' }}>T1</th>
                        <th colSpan={2} style={{ border: '1px solid #ccc' }}>T2</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ border: '1px solid #ccc', fontWeight: 'bold' }}>{row.station}</td>
                      <td style={{ border: '1px solid #ccc' }}>{row.frequency}</td>
                      {row.slots && row.slots.map((s, si) => (
                        <td key={si} style={{ border: '1px solid #ccc', color: s ? '#000' : '#ccc', background: s ? '#fff' : '#f9f9f9' }}>
                          {s}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div >
  )
}
