'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Appointment } from '@/types'
import CalendarView from '@/components/dashboard/CalendarView'
import UpcomingTasks from '@/components/dashboard/UpcomingTasks'
import AppointmentModal from '@/components/dashboard/AppointmentModal'

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    fetchAppointments()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
    } else {
      setUser(user)
    }
  }

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (error) {
        console.error('Error fetching appointments:', error)
      } else {
        setAppointments(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAppointment = async (appointmentData: Partial<Appointment>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (appointmentData.id) {
        // Update existing appointment
        const { error } = await supabase
          .from('appointments')
          .update({
            title: appointmentData.title,
            description: appointmentData.description,
            date: appointmentData.date,
            time: appointmentData.time,
            duration: appointmentData.duration,
            status: appointmentData.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', appointmentData.id)

        if (error) throw error
      } else {
        // Create new appointment
        const { error } = await supabase
          .from('appointments')
          .insert({
            title: appointmentData.title,
            description: appointmentData.description,
            date: appointmentData.date,
            time: appointmentData.time,
            duration: appointmentData.duration,
            status: appointmentData.status,
            user_id: user.id,
          })

        if (error) throw error
      }

      fetchAppointments()
    } catch (error) {
      console.error('Error saving appointment:', error)
      alert('Error saving appointment. Please check your Supabase configuration.')
    }
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedAppointment(null)
    setIsModalOpen(true)
  }

  const handleAppointmentClick = (id: string) => {
    const appointment = appointments.find((apt) => apt.id === id)
    if (appointment) {
      setSelectedAppointment(appointment)
      setSelectedDate(undefined)
      setIsModalOpen(true)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Scheduling Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.email}</p>
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
              <button
                onClick={handleSignOut}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CalendarView
            appointments={appointments}
            onDateSelect={handleDateSelect}
          />
          <UpcomingTasks
            appointments={appointments}
            onAppointmentClick={handleAppointmentClick}
          />
        </div>

        {/* All Appointments List */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">All Appointments</h2>
          {appointments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No appointments yet. Click &quot;New Appointment&quot; to create one.
            </p>
          ) : (
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
                  {appointments.map((appointment) => (
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
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          appointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
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
          )}
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
