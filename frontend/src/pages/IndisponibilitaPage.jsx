import React, { useEffect, useState } from 'react'
import api from '../util/api'
import QuarterTimeInput from '../components/QuarterTimeInput'

// Helper for dates - Ensuring we generate YYYY-MM-DD without timezone shifts
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper for weeks - Standard ISO logic
function getWeekRange(w, y) {
  const d = new Date(y, 0, 4);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  d.setDate(d.getDate() + (w - 1) * 7);

  const start = formatDate(d);
  const dEnd = new Date(d);
  dEnd.setDate(d.getDate() + 6);
  const end = formatDate(dEnd);
  return { start, end };
}

export default function IndisponibilitaPage() {
  const [activeTab, setActiveTab] = useState('UNAVAIL') // 'UNAVAIL' | 'AVAIL'
  const [staffList, setStaffList] = useState([])
  const [items, setItems] = useState([])

  const [currentYear] = useState(2025)
  const [loading, setLoading] = useState(false)

  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' })

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }

  const sortedItems = [...items].sort((a, b) => {
    let aVal, bVal;
    if (sortConfig.key === 'staff') {
      aVal = `${a.staff?.nome} ${a.staff?.cognome}`.toLowerCase();
      bVal = `${b.staff?.nome} ${b.staff?.cognome}`.toLowerCase();
    } else if (sortConfig.key === 'data') {
      aVal = a.data;
      bVal = b.data;
    } else {
      aVal = (a[sortConfig.key] || '').toLowerCase();
      bVal = (b[sortConfig.key] || '').toLowerCase();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // State for UNAVAIL form
  const [unavailForm, setUnavailForm] = useState({
    staffId: '',
    scope: 'single', // single, daily_range, weekly_range
    date: '',
    startDate: '',
    endDate: '',
    startWeek: '',
    endWeek: '',
    selectedDays: [1], // Array of numbers: 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab, 0=Dom
    tipo: 'TOTALE', // TOTALE, PARZIALE
    startTime: '',
    endTime: '',
    reason: ''
  })

  const [availForm, setAvailForm] = useState({
    staffId: '',
    scope: 'single',
    date: '',
    startDate: '',
    endDate: '',
    startWeek: '',
    endWeek: '',
    selectedDays: [1],
    startTime: '',
    endTime: ''
  })

  function toggleDay(form, setForm, day) {
    const current = form.selectedDays || [];
    if (current.includes(day)) {
      setForm({ ...form, selectedDays: current.filter(d => d !== day) });
    } else {
      setForm({ ...form, selectedDays: [...current, day] });
    }
  }

  const daysLabels = [
    { label: 'Lun', value: 1 },
    { label: 'Mar', value: 2 },
    { label: 'Mer', value: 3 },
    { label: 'Gio', value: 4 },
    { label: 'Ven', value: 5 },
    { label: 'Sab', value: 6 },
    { label: 'Dom', value: 0 },
  ];

  useEffect(() => {
    loadData();
  }, [])

  async function loadData(start, end) {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        api.getStaff(),
        api.getActivityHistory(start || filterStart, end || filterEnd)
      ]);
      setStaffList(s.sort((a, b) => a.nome.localeCompare(b.nome)));
      setItems(h);
    } catch (e) {
      alert("Errore nel caricamento: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(it) {
    if (!confirm(`Sei sicuro di voler eliminare questa attività per ${it.staff?.nome}?`)) return;
    try {
      if (it.activityType === 'UNAVAIL') {
        await api.deleteUnavailability(it.id);
      } else {
        await api.deleteAssignment(it.id);
      }
      alert("Eliminato correttamente.");
      loadData();
    } catch (e) {
      alert("Errore durante l'eliminazione: " + e.message);
    }
  }

  function handleFilter() {
    loadData(filterStart, filterEnd);
  }

  function clearFilters() {
    setFilterStart('');
    setFilterEnd('');
    loadData('', '');
  }

  // --- UNAVAIL LOGIC ---
  function handleUnavailChange(e) { setUnavailForm({ ...unavailForm, [e.target.name]: e.target.value }) }

  async function addUnavail() {
    const f = unavailForm;
    if (!f.staffId) return alert("Seleziona staff");
    if (!f.reason) return alert("Errore: Il motivo dell'assenza è obbligatorio.");

    // Prepare Data Loop similar to Availability
    // But upsertUnavailability endpoint takes (staffId, data, tipo)
    // Actually, 'tipo' in DB is String. We can store "PARZIALE 10:00-12:00" or just use "PRANZO"/"SERA" legacy?
    // User wants "tutto il giorno un orario specifico". 
    // Let's format 'tipo' as:
    // "TOTALE"
    // "PARZIALE 09:00-13:00"

    let typeStr = f.tipo;
    if (f.tipo === 'PARZIALE') {
      if (!f.startTime || !f.endTime) return alert("Inserisci orari per assenza parziale");
      typeStr = `PARZIALE ${f.startTime}-${f.endTime}`;
    }

    // Determine Dates to iterate
    let datesToProcess = [];

    if (f.scope === 'single') {
      if (!f.date) return alert("Seleziona data");
      datesToProcess.push(f.date);
    }
    else if (f.scope === 'daily_range') {
      if (!f.startDate || !f.endDate) return alert("Seleziona date");
      let curr = new Date(f.startDate);
      const end = new Date(f.endDate);
      while (curr <= end) {
        datesToProcess.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
    }
    else if (f.scope === 'weekly_range') {
      if (!f.startWeek || !f.endWeek) return alert("Seleziona settimane");
      if (!f.selectedDays || f.selectedDays.length === 0) return alert("Seleziona almeno un giorno");
      // Loop Weeks
      const startW = parseInt(f.startWeek);
      const endW = parseInt(f.endWeek);

      for (let w = startW; w <= endW; w++) {
        const { start } = getWeekRange(w, currentYear);
        const d = new Date(start);
        for (let i = 0; i < 7; i++) {
          const attempt = new Date(d);
          attempt.setDate(d.getDate() + i);
          if (f.selectedDays.includes(attempt.getDay())) {
            datesToProcess.push(formatDate(attempt));
          }
        }
      }
    }

    // PROCESS ALL
    for (const dStr of datesToProcess) {
      await api.upsertUnavailability({
        staffId: parseInt(f.staffId),
        data: dStr,
        tipo: f.tipo,
        reason: f.reason,
        startTime: f.startTime,
        endTime: f.endTime
      });
    }

    loadData();
    // Reset partial
    setUnavailForm({ ...unavailForm, date: '', startDate: '', endDate: '', reason: '' });
    alert(`Inserite ${datesToProcess.length} assenze.`);
  }

  // --- AVAIL LOGIC ---
  function handleAvailChange(e) { setAvailForm({ ...availForm, [e.target.name]: e.target.value }) }

  async function addAvail() {
    const f = availForm;
    if (!f.staffId) return alert("Seleziona Staff");
    if (!f.startTime || !f.endTime) return alert("Inserisci orari inizio e fine");

    // Determine Suffix based on Start Time
    const h = parseInt(f.startTime.split(':')[0]);
    const suf = h < 17 ? 'P' : 'S';

    // Prepare Payload
    let payload = {
      staffId: f.staffId,
      startTime: f.startTime,
      endTime: f.endTime,
      type: 'RANGE',
      scope: f.scope,
      reason: '',
      suffix: suf,
      force: false
    };

    // Scope Dates
    if (f.scope === 'single') {
      if (!f.date) return alert("Seleziona Data");
      payload.startDate = f.date;
      payload.endDate = f.date;
      payload.dayIndex = new Date(f.date).getDay();
    }
    else if (f.scope === 'daily_range') {
      if (!f.startDate || !f.endDate) return alert("Seleziona Date Inizio e Fine");
      payload.startDate = f.startDate;
      payload.endDate = f.endDate;
      payload.dayIndex = 0;
    }
    else if (f.scope === 'weekly_range') {
      if (!f.startWeek || !f.endWeek) return alert("Seleziona Settimane");
      if (!f.selectedDays || f.selectedDays.length === 0) return alert("Seleziona almeno un giorno");
      const { start: s1 } = getWeekRange(parseInt(f.startWeek), currentYear);
      const { end: e2 } = getWeekRange(parseInt(f.endWeek), currentYear);

      payload.startDate = s1;
      payload.endDate = e2;
      payload.dayIndex = f.selectedDays;
    }

    try {
      const res = await api.saveAvailability(payload);
      if (res.warning) {
        if (confirm(res.msg)) {
          payload.force = true;
          await api.saveAvailability(payload);
        } else {
          return;
        }
      }
      alert("Disponibilità salvata correttamente!");
      setAvailForm({ ...availForm, startTime: '', endTime: '' });
      loadData();
    } catch (e) {
      alert("Errore: " + e.message);
    }
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2>Inserimento Manuale (Disponibilità & Indisponibilità)</h2>
        <button className="btn" onClick={loadData} disabled={loading}>{loading ? '...' : '🔄 Aggiorna'}</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #ccc' }}>
        <button
          className="btn"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === 'UNAVAIL' ? '3px solid #d32f2f' : 'none',
            background: 'transparent',
            color: activeTab === 'UNAVAIL' ? '#d32f2f' : '#666',
            fontWeight: activeTab === 'UNAVAIL' ? 'bold' : 'normal'
          }}
          onClick={() => setActiveTab('UNAVAIL')}
        >
          ⛔ Indisponibilità (Assenze)
        </button>
        <button
          className="btn"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === 'AVAIL' ? '3px solid #2e7d32' : 'none',
            background: 'transparent',
            color: activeTab === 'AVAIL' ? '#2e7d32' : '#666',
            fontWeight: activeTab === 'AVAIL' ? 'bold' : 'normal'
          }}
          onClick={() => setActiveTab('AVAIL')}
        >
          ✅ Disponibilità (Turni)
        </button>
      </div>

      {activeTab === 'UNAVAIL' && (
        <div className="card" style={{ padding: '20px', background: '#fff' }}>
          <h3>Inserisci Assenza / Indisponibilità</h3>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>1. Dipendente</label>
              <select className="input" name="staffId" value={unavailForm.staffId} onChange={handleUnavailChange} style={{ width: '100%' }}>
                <option value="">-- Seleziona Staff --</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>2. Tipologia Periodo</label>
              <select className="input" name="scope" value={unavailForm.scope} onChange={handleUnavailChange} style={{ width: '100%' }}>
                <option value="single">Giorno Singolo</option>
                <option value="daily_range">Fascia di Giorni (Dal/Al)</option>
                <option value="weekly_range">Fascia di Settimane (Ricorrente)</option>
              </select>
            </div>

            {/* Scope Inputs */}
            {unavailForm.scope === 'single' && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Data</label>
                <input type="date" className="input" name="date" value={unavailForm.date} onChange={handleUnavailChange} style={{ width: '100%' }} />
              </div>
            )}
            {unavailForm.scope === 'daily_range' && (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Dal (Incluso)</label>
                  <input type="date" className="input" name="startDate" value={unavailForm.startDate} onChange={handleUnavailChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Al (Incluso)</label>
                  <input type="date" className="input" name="endDate" value={unavailForm.endDate} onChange={handleUnavailChange} style={{ width: '100%' }} />
                </div>
              </>
            )}
            {unavailForm.scope === 'weekly_range' && (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Dalla Sett.</label>
                  <input type="number" className="input" name="startWeek" style={{ width: '100%' }} value={unavailForm.startWeek} onChange={handleUnavailChange} placeholder="Es. 1" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Alla Sett.</label>
                  <input type="number" className="input" name="endWeek" style={{ width: '100%' }} value={unavailForm.endWeek} onChange={handleUnavailChange} placeholder="Es. 52" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Giorni</label>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {daysLabels.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        className="btn"
                        style={{
                          padding: '5px 8px',
                          fontSize: '0.85em',
                          backgroundColor: unavailForm.selectedDays.includes(d.value) ? '#d32f2f' : '#f5f5f5',
                          color: unavailForm.selectedDays.includes(d.value) ? 'white' : '#333',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontWeight: unavailForm.selectedDays.includes(d.value) ? 'bold' : 'normal'
                        }}
                        onClick={() => toggleDay(unavailForm, setUnavailForm, d.value)}
                      >
                        {d.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '5px 8px', fontSize: '0.85em', backgroundColor: '#eee', color: '#666', border: '1px solid #ccc', borderRadius: '4px' }}
                      onClick={() => setUnavailForm({ ...unavailForm, selectedDays: [1, 2, 3, 4, 5, 6, 0] })}
                    >
                      Tutti
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>3. Estensione Oraria</label>
              <select className="input" name="tipo" value={unavailForm.tipo} onChange={handleUnavailChange} style={{ width: '100%' }}>
                <option value="TOTALE">Tutto il giorno</option>
                <option value="PARZIALE">Fascia Oraria Specifica</option>
              </select>
            </div>

            {unavailForm.tipo === 'PARZIALE' && (
              <>
                <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Inizio</label>
                  <QuarterTimeInput value={unavailForm.startTime} onChange={v => setUnavailForm({ ...unavailForm, startTime: v })} />
                </div>
                <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Fine</label>
                  <QuarterTimeInput value={unavailForm.endTime} onChange={v => setUnavailForm({ ...unavailForm, endTime: v })} />
                </div>
              </>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#d32f2f', marginBottom: '5px' }}>4. Motivo dell'assenza (Obbligatorio)</label>
              <input type="text" className="input" name="reason" value={unavailForm.reason} onChange={handleUnavailChange} style={{ width: '100%' }} placeholder="Es. Ferie, Malattia, Permesso Personale..." />
            </div>

            <button className="btn" onClick={addUnavail} style={{ background: '#d32f2f', color: 'white', gridColumn: '1 / -1', height: '45px', fontSize: '1.1em' }}>
              🚀 Aggiungi Indisponibilità
            </button>
          </div>

          <div style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0 }}>Cronologia Attività</h4>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85em' }}>Dal:</label>
                <input type="date" className="input" style={{ padding: '4px', fontSize: '0.85em' }} value={filterStart} onChange={e => setFilterStart(e.target.value)} />
                <label style={{ fontSize: '0.85em' }}>Al:</label>
                <input type="date" className="input" style={{ padding: '4px', fontSize: '0.85em' }} value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
                <button className="btn" style={{ padding: '5px 12px', fontSize: '0.85em', background: '#333', color: '#fff' }} onClick={handleFilter}>Filtra</button>
                {(filterStart || filterEnd) && <button className="btn" style={{ padding: '5px 12px', fontSize: '0.85em', background: '#eee' }} onClick={clearFilters}>Reset</button>}
              </div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('staff')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Staff {sortConfig.key === 'staff' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleSort('data')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Data {sortConfig.key === 'data' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleSort('tipo')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Dettagli / Motivo {sortConfig.key === 'tipo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th style={{ width: '80px' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((it, idx) => (
                    <tr key={it.id || (it.activityType + idx)}>
                      <td style={{ fontWeight: 'bold' }}>{it.staff?.nome} {it.staff?.cognome}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(it.data).toLocaleDateString('it-IT')}</td>
                      <td>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: it.activityType === 'UNAVAIL' ? '#ffebee' : '#fff9c4',
                          color: it.activityType === 'UNAVAIL' ? '#c62828' : '#856404',
                          fontSize: '0.8em',
                          fontWeight: 'bold',
                          marginRight: '8px'
                        }}>
                          {it.activityType === 'UNAVAIL' ? 'ASSENZA' : 'TURNO'}
                        </span>
                        {it.tipo.replace('|', ' - ')}
                        {it.reason && <span style={{ marginLeft: '10px', color: '#666', fontStyle: 'italic' }}>({it.reason})</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn" onClick={() => handleDelete(it)} style={{ padding: '4px 8px', background: '#f44336', color: 'white' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', color: '#999' }}>Nessuna assenza registrata.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'AVAIL' && (
        <div className="card" style={{ padding: '20px', background: '#fff' }}>
          <h3>Inserisci Turno / Disponibilità</h3>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>1. Dipendente</label>
              <select className="input" name="staffId" value={availForm.staffId} onChange={handleAvailChange} style={{ width: '100%' }}>
                <option value="">-- Seleziona Staff --</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.nome} {s.cognome}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>2. Tipologia Periodo</label>
              <select className="input" name="scope" value={availForm.scope} onChange={handleAvailChange} style={{ width: '100%' }}>
                <option value="single">Giorno Singolo</option>
                <option value="daily_range">Fascia di Giorni (Dal/Al)</option>
                <option value="weekly_range">Fascia di Settimane (Ricorrente)</option>
              </select>
            </div>

            {/* Dynamic Inputs based on Scope */}
            {availForm.scope === 'single' && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Data</label>
                <input type="date" className="input" name="date" value={availForm.date} onChange={handleAvailChange} style={{ width: '100%' }} />
              </div>
            )}

            {availForm.scope === 'daily_range' && (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Dal (Incluso)</label>
                  <input type="date" className="input" name="startDate" value={availForm.startDate} onChange={handleAvailChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Al (Incluso)</label>
                  <input type="date" className="input" name="endDate" value={availForm.endDate} onChange={handleAvailChange} style={{ width: '100%' }} />
                </div>
              </>
            )}

            {availForm.scope === 'weekly_range' && (
              <>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Dalla Sett.</label>
                  <input type="number" className="input" name="startWeek" style={{ width: '100%' }} value={availForm.startWeek} onChange={handleAvailChange} placeholder="Es. 42" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Alla Sett.</label>
                  <input type="number" className="input" name="endWeek" style={{ width: '100%' }} value={availForm.endWeek} onChange={handleAvailChange} placeholder="Es. 45" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Giorni</label>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {daysLabels.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        className="btn"
                        style={{
                          padding: '5px 8px',
                          fontSize: '0.85em',
                          backgroundColor: availForm.selectedDays.includes(d.value) ? '#2e7d32' : '#f5f5f5',
                          color: availForm.selectedDays.includes(d.value) ? 'white' : '#333',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontWeight: availForm.selectedDays.includes(d.value) ? 'bold' : 'normal'
                        }}
                        onClick={() => toggleDay(availForm, setAvailForm, d.value)}
                      >
                        {d.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '5px 8px', fontSize: '0.85em', backgroundColor: '#eee', color: '#666', border: '1px solid #ccc', borderRadius: '4px' }}
                      onClick={() => setAvailForm({ ...availForm, selectedDays: [1, 2, 3, 4, 5, 6, 0] })}
                    >
                      Tutti
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1565c0', marginBottom: '5px' }}>Ora Inizio</label>
              <input type="time" className="input" name="startTime" value={availForm.startTime} onChange={handleAvailChange} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', color: '#1565c0', marginBottom: '5px' }}>Ora Fine</label>
              <input type="time" className="input" name="endTime" value={availForm.endTime} onChange={handleAvailChange} style={{ width: '100%' }} />
            </div>

            <button className="btn" onClick={addAvail} style={{ background: '#2e7d32', color: 'white', gridColumn: '1 / -1', height: '45px', fontSize: '1.1em' }}>
              🚀 Salva Disponibilità
            </button>

          </div>
          <div style={{ marginTop: '20px', padding: '15px', background: '#e8f5e9', borderRadius: '8px', fontSize: '0.9em', color: '#2e7d32', border: '1px solid #c8e6c9' }}>
            <strong>📌 Nota:</strong> I turni salvati qui vengono inseriti direttamente nel sistema di pianificazione (tabella orari).
            Puoi visualizzarli e gestirli nella <strong>"Dashboard"</strong> o nella <strong>"Griglia"</strong>.
          </div>
        </div>
      )}
    </div>
  )
}

