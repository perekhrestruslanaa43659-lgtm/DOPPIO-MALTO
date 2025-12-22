'use client'

import { useState } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { format } from 'date-fns'
import { Appointment } from '@/types'

interface CalendarViewProps {
  appointments: Appointment[]
  onDateSelect: (date: Date) => void
}

export default function CalendarView({ appointments, onDateSelect }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const handleDateChange = (value: any) => {
    setSelectedDate(value)
    onDateSelect(value)
  }

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayAppointments = appointments.filter(
        (apt) => apt.date === dateStr
      )
      
      if (dayAppointments.length > 0) {
        return (
          <div className="flex justify-center mt-1">
            <span className="inline-block w-2 h-2 bg-indigo-600 rounded-full"></span>
          </div>
        )
      }
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Calendar</h2>
      <Calendar
        onChange={handleDateChange}
        value={selectedDate}
        tileContent={tileContent}
        className="w-full border-0"
      />
      <div className="mt-4 text-sm text-gray-600">
        <p>Selected: {format(selectedDate, 'MMMM d, yyyy')}</p>
      </div>
    </div>
  )
}
