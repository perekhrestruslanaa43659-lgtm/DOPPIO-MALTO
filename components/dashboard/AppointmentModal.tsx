'use client'

import { useState, useEffect } from 'react'
import { Appointment } from '@/types'
import { format } from 'date-fns'

interface AppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (appointment: Partial<Appointment>) => void
  appointment?: Appointment | null
  initialDate?: Date
}

export default function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  appointment,
  initialDate,
}: AppointmentModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('pending')

  useEffect(() => {
    if (appointment) {
      setTitle(appointment.title)
      setDescription(appointment.description)
      setDate(appointment.date)
      setTime(appointment.time)
      setDuration(appointment.duration)
      setStatus(appointment.status)
    } else if (initialDate) {
      setDate(format(initialDate, 'yyyy-MM-dd'))
      setTime('09:00')
    } else {
      const today = new Date()
      setDate(format(today, 'yyyy-MM-dd'))
      setTime('09:00')
    }
  }, [appointment, initialDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...(appointment && { id: appointment.id }),
      title,
      description,
      date,
      time,
      duration,
      status,
    })
    handleClose()
  }

  const handleClose = () => {
    setTitle('')
    setDescription('')
    setDate('')
    setTime('')
    setDuration(30)
    setStatus('pending')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {appointment ? 'Edit Appointment' : 'New Appointment'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Meeting with client"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Discuss project requirements"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (min)
                </label>
                <input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  required
                  min="15"
                  step="15"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {appointment ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
