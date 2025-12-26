import React, { useEffect, useState } from 'react'
import api from '../util/api'
import * as XLSX from 'xlsx'

export default function StaffPage() {
  const [staff, setStaff] = useState([])
  const [form, setForm] = useState({
    nome: '',
    cognome: '',
    email: '',
    ruolo: '',
    oreMinime: 0,
    oreMassime: 40,
    costoOra: 0,
    postazioni: ''
  })
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    api.getStaff().then(setStaff)
  }, [])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function add() {
    try {
      const payload = { ...form }
      if (!payload.email) delete payload.email

      if (editing) {
        await api.updateStaff(editing, payload)
        setEditing(null)
      } else {
        await api.upsertStaff(payload)
      }

      const s = await api.getStaff()
      setStaff(s)
      setForm({
        nome: '',
        cognome: '',
        email: '',
        ruolo: '',
        oreMinime: 0,
        oreMassime: 40,
        costoOra: 0,
        postazioni: ''
      })
    } catch (e) {
      alert("Errore salva/aggiorna: " + e.message)
    }
  }

  function startEdit(s) {
    setEditing(s.id)
    setForm({
      nome: s.nome,
      cognome: s.cognome || '',
      email: s.email || '',
      ruolo: s.ruolo,
      oreMinime: s.oreMinime,
      oreMassime: s.oreMassime,
      costoOra: s.costoOra,
      postazioni: s.postazioni || ''
    })
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // 1. Find the Header Row (Extended Intelligence)
        let headerRowIndex = -1;
        // Expanded keywords to catch more variations
        const requiredCols = ['nome', 'name', 'dipendente', 'personale', 'collaboratore', 'staff'];

        for (let i = 0; i < Math.min(rows.length, 50); i++) { // Scan deeper (50 rows)
          const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
          if (requiredCols.some(r => rowStr.includes(r))) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          // Fallback: If no header found, assume row 0 is header TO TRY, or look for specific data patterns (like email)
          // For now, let's warn but check if user wants to proceed with index 0
          if (!confirm("Non ho trovato intestazioni chiare (es. 'Nome'). Vuoi provare a usare la prima riga come intestazione?")) {
            return;
          }
          headerRowIndex = 0;
        }

        // 2. Map Column Indices (Fuzzy Matching)
        const headers = rows[headerRowIndex].map(h => String(h).trim().toLowerCase());
        const getColIdx = (...search) => headers.findIndex(h => search.some(s => h.includes(s)));

        const idxNome = getColIdx('nome', 'name', 'dipendente', 'first', 'personale');
        const idxCognome = getColIdx('cognome', 'surname', 'last', 'family');
        const idxEmail = getColIdx('email', 'e-mail', 'mail', 'indirizzo');
        const idxRuolo = getColIdx('ruolo', 'role', 'mansione', 'job', 'posizione', 'livello');
        const idxMin = getColIdx('min', 'ore min');
        const idxMax = getColIdx('max', 'ore max', 'ore settimanali');
        const idxCosto = getColIdx('costo', 'cost', 'tariffa', 'paga', 'retribuzione');
        const idxPost = getColIdx('postazioni', 'stations', 'skills', 'abilità', 'dove', 'reparto');

        if (idxNome === -1) {
          alert("Colonna 'Nome' (o simile) non trovata.");
          return;
        }

        // 3. Extract Data (Smart Parsing)
        const payload = rows.slice(headerRowIndex + 1).map(row => {
          if (!row[idxNome]) return null;

          let nome = String(row[idxNome]).trim();
          let cognome = idxCognome > -1 ? String(row[idxCognome] || '').trim() : '';

          // INTELLIGENZA: Se manca il cognome ma il nome ha spazi (es. "Mario Rossi"), spacchettalo
          if (!cognome && nome.includes(' ')) {
            const parts = nome.split(' ');
            nome = parts[0];
            cognome = parts.slice(1).join(' ');
          }

          // INTELLIGENZA: Se l'email manca, ma c'è una colonna che sembra una mail nel range, provala?
          // Per ora, sicurezza: se mail manca, null.

          return {
            nome,
            cognome,
            email: idxEmail > -1 ? row[idxEmail] : undefined,
            ruolo: idxRuolo > -1 ? row[idxRuolo] : 'Staff',
            oreMinime: idxMin > -1 ? (row[idxMin] || 0) : 0,
            oreMassime: idxMax > -1 ? (row[idxMax] || 40) : 40,
            costoOra: idxCosto > -1 ? (row[idxCosto] || 0) : 0,
            postazioni: idxPost > -1 && row[idxPost] ? String(row[idxPost]).trim() : ''
          };
        }).filter(p => p !== null);

        if (payload.length === 0) {
          alert("Nessun dato trovato sotto la riga di intestazione.");
          return;
        }

        if (confirm(`Trovate ${payload.length} righe. Importare?`)) {
          const res = await api.importStaff(payload);
          alert(`Importati ${res.count} nuovi membri.`);
          const s = await api.getStaff();
          setStaff(s);
        }
      } catch (err) {
        alert("Errore importazione: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  }

  // Edit logic is simplified to just Delete + Re-add for this MVP or UI updates
  // Real implementation would pass ID to update

  async function removeRow(id, nome) {
    if (!confirm(`Eliminare ${nome}?`)) return;
    try {
      await api.deleteStaff(id)
      const s = await api.getStaff()
      setStaff(s)
    } catch (e) { alert('Errore cancellazione: ' + e.message) }
  }

  return (
    <div className="container">
      <div className="header-actions" style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Gestione Staff</h2>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#555' }}>Aggiungi Nuovo Dipendente</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Nome</label>
            <input className="input" placeholder="Nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Cognome</label>
            <input className="input" placeholder="Cognome" value={form.cognome} onChange={e => setForm({ ...form, cognome: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Ruolo</label>
            <input className="input" placeholder="Ruolo" value={form.ruolo} onChange={e => setForm({ ...form, ruolo: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="input" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Ore Min</label>
            <input className="input" type="number" placeholder="Min" value={form.oreMinime} onChange={e => setForm({ ...form, oreMinime: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label>Ore Max</label>
            <input className="input" type="number" placeholder="Max" value={form.oreMassime} onChange={e => setForm({ ...form, oreMassime: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label>Costo/h</label>
            <input className="input" type="number" placeholder="€/h" value={form.costoOra} onChange={e => setForm({ ...form, costoOra: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.35rem' }}>Postazioni Abilitate:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {['BAR SU', "BAR GIU'", 'B/S', 'PASS', 'CDR', 'ACC', 'CUCINA'].map(p => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.postazioni.split(',').filter(x => x).includes(p)}
                  onChange={() => {
                    const current = form.postazioni.split(',').filter(x => x);
                    const newPostazioni = current.includes(p)
                      ? current.filter(x => x !== p)
                      : [...current, p];
                    setForm({ ...form, postazioni: newPostazioni.join(',') });
                  }}
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn active" onClick={add}>{editing ? 'Aggiorna Dipendente' : 'Aggiungi Dipendente'}</button>
          {editing && <button className="btn" style={{ backgroundColor: '#aaa' }} onClick={() => {
            setEditing(null);
            setForm({
              nome: '', cognome: '', email: '', ruolo: '',
              oreMinime: 0, oreMassime: 40, costoOra: 0, postazioni: ''
            });
          }}>Annulla Modifica</button>}
          <label className="btn" style={{ background: '#10b981', color: 'white', border: 'none' }}>
            Importa Excel
            <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} accept=".xlsx, .xls" />
          </label>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
          (Colonne per Excel: Nome, Cognome, Email, Ruolo, OreMin, OreMax, Costo, Postazioni)
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Cognome</th>
                <th>Ruolo</th>
                <th>Email</th>
                <th>Ore Min</th>
                <th>Ore Max</th>
                <th>Costo/h</th>
                <th>Postazioni</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.nome}</td>
                  <td>{s.cognome}</td>
                  <td>{s.ruolo}</td>
                  <td>{s.email}</td>
                  <td>{s.oreMinime}</td>
                  <td>{s.oreMassime}</td>
                  <td>{s.costoOra}</td>
                  <td>{Array.isArray(s.postazioni) ? s.postazioni.join(', ') : (s.postazioni || '')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className="btn" onClick={() => startEdit(s)} style={{ padding: '5px 10px', fontSize: '0.8em' }}>Modifica</button>
                      <button className="btn" style={{ padding: '5px 10px', fontSize: '0.8em', background: '#ef4444', color: 'white', border: 'none' }} onClick={() => removeRow(s.id, s.nome)}>Elimina</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
