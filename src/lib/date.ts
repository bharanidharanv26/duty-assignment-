const INVALID_DATE = /^\d{4}-\d{2}-\d{2}$/

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function isISODate(value: string | null | undefined): value is string {
  if (!value || !INVALID_DATE.test(value)) return false
  const date = parseISODate(value)
  return !Number.isNaN(date.getTime()) && toISODate(date) === value
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(value: string, days: number): string {
  const date = parseISODate(value)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** "Monday, 9 November 2026" */
export function formatFullDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseISODate(value))
}

/** "9 Nov 2026" */
export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseISODate(value))
}

/** "9 November 2026" */
export function formatMediumDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseISODate(value))
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** First and last day of the month as ISO dates. */
export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const end = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`
  return { start, end }
}

export interface CalendarDay {
  iso: string
  day: number
}

/**
 * Calendar cells for a month (Monday first). Leading/trailing cells are null.
 */
export function getMonthWeeks(year: number, month: number): (CalendarDay | null)[][] {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7 // Monday = 0
  const total = daysInMonth(year, month)
  const cells: (CalendarDay | null)[] = Array.from({ length: firstWeekday }, () => null)
  for (let day = 1; day <= total; day += 1) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    cells.push({ iso, day })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (CalendarDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
