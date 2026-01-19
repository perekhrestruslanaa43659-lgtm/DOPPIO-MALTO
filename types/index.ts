// Authentication Types
export interface User {
    id: number;
    email: string;
    name: string | null;
    role: string;
    surname?: string | null;
    dob?: string | null;
    address?: string | null;
    tenantKey: string;
    companyName?: string | null;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    role?: string;
    companyName: string;
}

export interface AuthResponse {
    user: User;
    token?: string;
}

// Staff Types
export interface Staff {
    id: number;
    tenantKey: string;
    nome: string;
    cognome: string;
    email?: string | null;
    ruolo: string;
    oreMinime: number;
    oreMassime: number;
    costoOra: number;
    postazioni: string[];
    fixedShifts?: Record<string, any>;
    listIndex: number;
    createdAt?: Date;
}

// Shift Template Types
export interface ShiftTemplate {
    id: number;
    tenantKey: string;
    nome: string;
    oraInizio: string;
    oraFine: string;
    ruoloRichiesto: string;
    giorniValidi: number[];
}

// Assignment Types
export interface Assignment {
    id: number;
    tenantKey: string;
    data: string;
    staffId: number;
    shiftTemplateId?: number | null;
    stato: string;
    postazione?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    status?: boolean | null;
    staff?: Staff;
    shiftTemplate?: ShiftTemplate | null;
}

// Unavailability Types
export interface Unavailability {
    id: number;
    tenantKey: string;
    staffId: number;
    data: string;
    tipo: string;
    reason?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    staff?: Staff;
}

// Coverage Types
export interface CoverageRow {
    id: number;
    tenantKey: string;
    weekStart: string;
    station: string;
    frequency: string;
    slots: Record<string, any>;
    extra: Record<string, any>;
}

// Forecast Types
export interface ForecastRow {
    id: number;
    tenantKey: string;
    weekStart: string;
    data: string;
    createdAt?: Date;
}

// Budget Types
export interface Budget {
    id: number;
    tenantKey: string;
    data: string;
    valueDinner: number;
    valueLunch: number;
    hoursDinner: number;
    hoursLunch: number;
    value: number;
    created_at?: Date;
}

// API Response Types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface ApiError {
    error: string;
    message?: string;
    statusCode?: number;
}
