'use client'

import { useState } from 'react'
import { format, addDays } from 'date-fns'
import CalendarView from '@/components/dashboard/CalendarView'
import UpcomingTasks from '@/components/dashboard/UpcomingTasks'
import AppointmentModal from '@/components/dashboard/AppointmentModal'
import { Appointment } from '@/types'

// Demo data for showcasing the dashboard
const demoAppointments: Appointment[] = [
  {
    id: '1',
    title: 'Team Meeting',
    description: 'Weekly sync with the development team',
    date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    time: '10:00',
    duration: 60,
    status: 'confirmed',
    user_id: 'demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Client Presentation',
    description: 'Q4 results presentation for stakeholders',
    date: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
    time: '14:00',
    duration: 90,
    status: 'pending',
    user_id: 'demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Doctor Appointment',
    description: 'Annual checkup',
    date: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
    time: '09:30',
    duration: 45,
    status: 'confirmed',
    user_id: 'demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Project Review',
    description: 'Review sprint progress and plan next iteration',
    date: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    time: '15:30',
    duration: 120,
    status: 'confirmed',
    user_id: 'demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'Lunch with Sarah',
    description: 'Catch up over lunch',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '12:00',
    duration: 60,
    status: 'confirmed',
    user_id: 'demo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export default function DemoPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(demoAppointments)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()

  const handleSaveAppointment = (appointmentData: Partial<Appointment>) => {
    if (appointmentData.id) {
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === appointmentData.id
            ? { ...apt, ...appointmentData, updated_at: new Date().toISOString() }
            : apt
        )
      )
    } else {
      const newAppointment: Appointment = {
        id: Date.now().toString(),
        title: appointmentData.title || '',
        description: appointmentData.description || '',
        date: appointmentData.date || '',
        time: appointmentData.time || '',
        duration: appointmentData.duration || 30,
        status: appointmentData.status || 'pending',
        user_id: 'demo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setAppointments(prev => [...prev, newAppointment])
    }
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedAppointment(null)
    setIsModalOpen(true)
  }

  const handleAppointmentClick = (id: string) => {
    const appointment = appointments.find(apt => apt.id === id)
    if (appointment) {
      setSelectedAppointment(appointment)
      setSelectedDate(undefined)
      setIsModalOpen(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Scheduling Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, demo@example.com (Demo Mode)</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setSelectedAppointment(null)
                  setSelectedDate(undefined)
                  setIsModalOpen(true)
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                + New Appointment
              </button>
              <a
                href="/auth/login"
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Exit Demo
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CalendarView appointments={appointments} onDateSelect={handleDateSelect} />
          <UpcomingTasks appointments={appointments} onAppointmentClick={handleAppointmentClick} />
        </div>

        {/* All Appointments List */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">All Appointments</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appointments.map(appointment => (
                  <tr key={appointment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{appointment.title}</div>
                      <div className="text-sm text-gray-500">{appointment.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {appointment.date} at {appointment.time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {appointment.duration} min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          appointment.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : appointment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : appointment.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleAppointmentClick(appointment.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAppointment}
        appointment={selectedAppointment}
        initialDate={selectedDate}
      />
    </div>
  )
}
