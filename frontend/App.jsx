import React from 'react'
import StaffPage from './pages/StaffPage'
import TurniPage from './pages/TurniPage'

export default function App(){
  return (
    <div className="app">
      <header>
        <h1>Scheduling Dashboard</h1>
      </header>
      <main>
        <StaffPage />
        <TurniPage />
      </main>
    </div>
  )
}
