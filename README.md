# Scheduling Dashboard

A professional scheduling dashboard built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🔐 User authentication (login/signup) with Supabase
- 📅 Interactive calendar view
- 📋 Upcoming tasks list
- ✨ Create, edit, and manage appointments
- 📱 Responsive design
- 🎨 Professional UI with Tailwind CSS

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase (PostgreSQL)
- **Calendar:** react-calendar
- **Date Utils:** date-fns

## Prerequisites

- Node.js 18+ installed
- A Supabase account and project

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be set up

### 2. Create the Database Table

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create appointments table
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_date ON appointments(date);

-- Enable Row Level Security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own appointments"
  ON appointments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments"
  ON appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments"
  ON appointments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments"
  ON appointments FOR DELETE
  USING (auth.uid() = user_id);
```

### 3. Get Your Supabase Credentials

1. Go to Project Settings > API
2. Copy the Project URL
3. Copy the `anon` `public` key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd DOPPIO-MALTO
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` and add your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Sign Up:** Create a new account on the signup page
2. **Sign In:** Log in with your credentials
3. **Dashboard:** View your calendar and upcoming appointments
4. **Create Appointment:** Click "New Appointment" to add a new appointment
5. **Edit Appointment:** Click on any appointment to edit it
6. **Calendar:** Click on a date in the calendar to create an appointment for that day

## Project Structure

```
├── app/
│   ├── auth/
│   │   ├── login/          # Login page
│   │   └── signup/         # Signup page
│   ├── dashboard/          # Main dashboard page
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page (redirects)
├── components/
│   └── dashboard/
│       ├── CalendarView.tsx          # Calendar component
│       ├── UpcomingTasks.tsx         # Upcoming tasks list
│       └── AppointmentModal.tsx      # Appointment form modal
├── lib/
│   └── supabase/
│       ├── client.ts       # Supabase client for client components
│       └── server.ts       # Supabase client for server components
├── types/
│   └── index.ts            # TypeScript type definitions
├── middleware.ts           # Next.js middleware for auth
└── tailwind.config.ts      # Tailwind configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

ISC