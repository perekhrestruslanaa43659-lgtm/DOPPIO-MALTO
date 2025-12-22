import React, { useEffect, useState } from 'react'
import api from '../util/api'

export default function IndisponibilitaPage() {
  const [items, setItems] = useState([])
  const [staffList, setStaffList] = useState([])
  const [form, setForm] = useState({ staffId: '', data: '', tipo: 'TOTALE', mode: 'SINGLE', startConf: '', endConf: '', days: [] })

  useEffect(() => {
    api.getUnavailability().then(setItems).catch(() => setItems([]))
    api.getStaff().then(setStaffList)
  }, [])

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }

  async function add() {
    if (!form.staffId) return alert("Seleziona staff");

    // Logic for RANGE
    if (form.mode === 'RANGE') {
      if (!form.startConf || !form.endConf || (!form.days || form.days.length === 0)) {
        return alert("Seleziona periodo e almeno un giorno della settimana");
      }

      let curr = new Date(form.startConf);
      const end = new Date(form.endConf);
      const promises = [];

      while (curr <= end) {
        if (form.days.includes(curr.getDay())) {
          const dateStr = curr.toISOString().split('T')[0];
          promises.push(api.upsertUnavailability({
            staffId: form.staffId,
            data: dateStr,
            tipo: form.tipo
          }));
        }
        curr.setDate(curr.getDate() + 1);
      }
      await Promise.all(promises);

    } else {
      // SINGLE
      if (!form.data) return alert("Seleziona data");
      await api.upsertUnavailability({
        staffId: form.staffId,
        data: form.data,
        tipo: form.tipo
      });
    }

    const list = await api.getUnavailability();
    setItems(list);
    // Reset minimal
    setForm({ ...form, data: '' });
  }

  return (
    <div className="panel">
      <h2>Indisponibilità</h2>
      <div className="form-row">
        <select className="input" name="staffId" value={form.staffId} onChange={handleChange}>
          <option value="">-- Seleziona Staff --</option>
          {staffList.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>

        <input className="input" type="date" name="data" value={form.data} onChange={handleChange} />

        <select className="input" name="tipo" value={form.tipo} onChange={handleChange}>
          <option value="TOTALE">TOTALE (Tutto il giorno)</option>
          <option value="PRANZO">PRANZO</option>
          <option value="SERA">SERA</option>
        </select>

        <button className="btn" onClick={add}>Aggiungi</button>
      </div>

      <table className="table">
        <thead><tr><th>Staff</th><th>Data</th><th>Tipo</th></tr></thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id || idx}>
              <td>{it.staff?.nome || it.staffId}</td>
              <td>{it.data}</td>
              <td>{it.tipo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

