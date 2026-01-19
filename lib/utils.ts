import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get Monday of the week for a given date
 */
export function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

/**
 * Get week dates (Monday to Sunday) for a given date
 */
export function getWeekDates(date: Date): Date[] {
    const monday = getMonday(date);
    const dates: Date[] = [];

    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d);
    }

    return dates;
}

/**
 * Parse Italian number format (comma as decimal separator)
 */
export function parseItalianNumber(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}
