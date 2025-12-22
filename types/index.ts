export interface Appointment {
  id: string
  title: string
  description: string
  date: string
  time: string
  duration: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  user_id: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  due_date: string
  completed: boolean
  user_id: string
  created_at: string
}
