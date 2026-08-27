/**
 * shared/utils/format.ts
 * Single source of truth for all formatting helpers.
 * Replaces 10+ page-local copies of formatCurrency / formatDateTime / formatDateForApi.
 */

/**
 * Formats a number as Vietnamese Dong currency.
 * e.g. 150000 → "150.000 đ"
 */
export function formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(value ?? 0)} đ`
}

/**
 * Formats a number without currency symbol.
 * e.g. 150000 → "150.000"
 */
export function formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value ?? 0)
}

/**
 * Formats a number as a compact currency string for charts.
 * e.g. 1500000 → "1,5M đ"
 */
export function formatCurrencyCompact(value: number): string {
    return (
        new Intl.NumberFormat('vi-VN', {
            notation: 'compact',
            compactDisplay: 'short',
        }).format(value ?? 0) + ' đ'
    )
}

/**
 * Formats an ISO date-time string for display.
 * e.g. "2025-01-15T14:30:00" → "15/01/2025 14:30"
 */
export function formatDateTime(value: string): string {
    const d = new Date(value)
    const date = d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
    const time = d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    })
    return `${date} ${time}`
}

/**
 * Formats a Date object to "YYYY-MM-DD" for API requests.
 * e.g. new Date(2025, 0, 15) → "2025-01-15"
 */
export function formatDateForApi(date: Date): string {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

/**
 * Returns the Monday of the week containing the given date.
 */
export function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
}

/**
 * Returns the Sunday of the week containing the given date.
 */
export function getWeekEnd(date: Date): Date {
    const start = getWeekStart(date)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
}
