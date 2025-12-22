'use client'

import { format, parseISO, isFuture } from 'date-fns'
import { Appointment } from '@/types'

interface UpcomingTasksProps {
  appointments: Appointment[]
  onAppointmentClick: (id: string) => void
}

export default function UpcomingTasks({ appointments, onAppointmentClick }: UpcomingTasksProps) {
  const upcomingAppointments = appointments
    .filter((apt) => {
      const aptDate = parseISO(`${apt.date}T${apt.time}`)
      return isFuture(aptDate) && apt.status !== 'cancelled'
    })
    .sort((a, b) => {
      const dateA = parseISO(`${a.date}T${a.time}`)
      const dateB = parseISO(`${b.date}T${b.time}`)
      return dateA.getTime() - dateB.getTime()
    })
    .slice(0, 10)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Tasks</h2>
      {upcomingAppointments.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No upcoming appointments</p>
      ) : (
        <div className="space-y-3">
          {upcomingAppointments.map((appointment) => (
            <div
              key={appointment.id}
              onClick={() => onAppointmentClick(appointment.id)}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-900">{appointment.title}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(appointment.status)}`}>
                  {appointment.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{appointment.description}</p>
              <div className="flex items-center text-sm text-gray-500 space-x-4">
                <span className="flex items-center">
                  📅 {format(parseISO(appointment.date), 'MMM d, yyyy')}
                </span>
                <span className="flex items-center">
                  🕐 {appointment.time}
                </span>
                <span className="flex items-center">
                  ⏱️ {appointment.duration} min
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
