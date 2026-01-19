import React, {useEffect, useState} from 'react'
import api from '../util/api'

export default function StaffPage(){
  const [staff, setStaff] = useState([])
  const [form, setForm] = useState({Nome:'',OreMinSettimana:'',OreMaxSettimana:'',CostoOrario:''})

  useEffect(()=>{
    api.getStaff().then(setStaff)
  },[])

  function handleChange(e){
    setForm({...form,[e.target.name]:e.target.value})
  }

  async function add(){
    await api.upsertStaff(form)
    const s = await api.getStaff()
    setStaff(s)
    setForm({Nome:'',OreMinSettimana:'',OreMaxSettimana:'',CostoOrario:''})
  }

  return (
    <div className="panel">
      <h2>Staff</h2>
      <div className="form-row">
        <input className="input" name="Nome" placeholder="Nome" value={form.Nome} onChange={handleChange} />
        <input className="input" name="OreMinSettimana" placeholder="OreMin" value={form.OreMinSettimana} onChange={handleChange} />
        <input className="input" name="OreMaxSettimana" placeholder="OreMax" value={form.OreMaxSettimana} onChange={handleChange} />
        <input className="input" name="CostoOrario" placeholder="CostoOrario" value={form.CostoOrario} onChange={handleChange} />
        <button className="btn" onClick={add}>Aggiungi/Upsert</button>
      </div>

      <table className="table">
        <thead><tr><th>Nome</th><th>Min</th><th>Max</th><th>Costo</th></tr></thead>
        <tbody>
          {staff.map(s=> (
            <tr key={s.Nome}><td>{s.Nome}</td><td>{s.OreMinSettimana}</td><td>{s.OreMaxSettimana}</td><td>{s.CostoOrario}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
