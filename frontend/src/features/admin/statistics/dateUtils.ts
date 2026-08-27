import type {RangePreset, WeekOption} from './types'
import type {OrderShiftReportResponse} from '@/shared/api/admin'
export const vietnameseWeekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export const vietnameseMonthLabels = Array.from(
    {
        length: 12,
    },
    (_, index) => `Tháng ${index + 1}`,
)

export function formatDateForApi(date: Date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')

    return `${year}-${month}-${day}`
}

export function addDays(date: Date, amount: number) {
    const nextDate = new Date(date)

    nextDate.setDate(nextDate.getDate() + amount)

    return nextDate
}

export function getTodayRange() {
    const today = formatDateForApi(new Date())

    return {
        fromDate: today,
        toDate: today,
    }
}

export function getLastSevenDayRange() {
    const today = new Date()

    return {
        fromDate: formatDateForApi(addDays(today, -6)),
        toDate: formatDateForApi(today),
    }
}

export function getSundayOfWeek(date: Date) {
    const sunday = new Date(date)
    const day = sunday.getDay()
    const daysUntilSunday = day === 0 ? 0 : 7 - day

    sunday.setDate(sunday.getDate() + daysUntilSunday)

    return sunday
}

export function getNextMonday(date: Date) {
    const nextMonday = new Date(date)
    const day = nextMonday.getDay()
    const daysUntilMonday = day === 0 ? 1 : 8 - day

    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)

    return nextMonday
}

export function formatShortDate(date: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
    }).format(date)
}

export function getYearOptions() {
    const currentYear = new Date().getFullYear()

    return Array.from(
        {
            length: 5,
        },
        (_, index) => currentYear - index,
    )
}

export function buildWeekOptions(year: number): WeekOption[] {
    const today = new Date()
    const currentYear = today.getFullYear()
    const endOfYear = new Date(year, 11, 31)
    const options: WeekOption[] = []

    let weekStart = new Date(year, 0, 1)

    while (
        weekStart.getFullYear() === year &&
        (year < currentYear || weekStart <= today)
    ) {
        const weekEnd = getSundayOfWeek(weekStart)
        const boundedEnd =
            year === currentYear && weekEnd > today
                ? today
                : weekEnd > endOfYear
                  ? endOfYear
                  : weekEnd

        options.push({
            value: formatDateForApi(weekStart),
            label: `${formatShortDate(weekStart)} - ${formatShortDate(boundedEnd)}`,
            fromDate: formatDateForApi(weekStart),
            toDate: formatDateForApi(boundedEnd),
        })

        weekStart = getNextMonday(weekStart)
    }

    return options
}

export function getDefaultWeek(year: number) {
    const options = buildWeekOptions(year)

    return (
        options[options.length - 1] ?? {
            value: formatDateForApi(new Date()),
            label: formatShortDate(new Date()),
            fromDate: formatDateForApi(new Date()),
            toDate: formatDateForApi(new Date()),
        }
    )
}

export function getRangeFromPreset(preset: RangePreset, selectedWeek?: WeekOption) {
    if (preset === 'CUSTOM_WEEK') {
        return selectedWeek ?? getDefaultWeek(new Date().getFullYear())
    }

    return preset === 'TODAY' ? getTodayRange() : getLastSevenDayRange()
}

export function formatDisplayDate(date: string) {
    const [year, month, day] = date.split('-')

    return `${day}/${month}/${year}`
}

export function getCalendarMonthDate(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function getCalendarDays(viewDate: Date) {
    const monthStart = getCalendarMonthDate(viewDate)
    const mondayOffset = (monthStart.getDay() + 6) % 7
    const gridStart = addDays(monthStart, -mondayOffset)

    return Array.from(
        {
            length: 42,
        },
        (_, index) => addDays(gridStart, index),
    )
}

export function isSameCalendarDate(firstDate: Date, secondDate: Date) {
    return (
        firstDate.getFullYear() === secondDate.getFullYear() &&
        firstDate.getMonth() === secondDate.getMonth() &&
        firstDate.getDate() === secondDate.getDate()
    )
}

export function getCalendarYearOptions(viewYear: number) {
    const currentYear = new Date().getFullYear()
    const startYear = Math.min(currentYear - 5, viewYear - 5)
    const endYear = Math.max(currentYear + 5, viewYear + 5)

    return Array.from(
        {
            length: endYear - startYear + 1,
        },
        (_, index) => startYear + index,
    )
}

export function formatManualDateInput(value: string) {
    const dateParts = value.trim().split(/\D+/).filter(Boolean)

    if (dateParts.length >= 3) {
        const [dayPart, monthPart, yearPart] = dateParts
        const day = dayPart.slice(0, 2).padStart(2, '0')
        const month = monthPart.slice(0, 2).padStart(2, '0')
        const year = yearPart.slice(0, 4)

        return [day, month, year].filter(Boolean).join('/')
    }

    const digits = value.replace(/\D/g, '').slice(0, 8)
    const day = digits.slice(0, 2)
    const month = digits.slice(2, 4)
    const year = digits.slice(4, 8)

    return [day, month, year].filter(Boolean).join('/')
}

export function parseVietnameseDate(value: string) {
    const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)

    if (!match) {
        return null
    }

    const [, dayText, monthText, yearText] = match
    const day = Number(dayText)
    const month = Number(monthText)
    const year = Number(yearText)
    const parsedDate = new Date(year, month - 1, day)

    if (
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
    ) {
        return null
    }

    return parsedDate
}

export function parseManualDateForApi(value: string) {
    const parsedDate = parseVietnameseDate(value)

    return parsedDate ? formatDateForApi(parsedDate) : null
}

export function getRangeLabelFromPreset(preset: RangePreset, selectedWeek?: WeekOption) {
    const range = getRangeFromPreset(preset, selectedWeek)

    return `${formatDisplayDate(range.fromDate)} - ${formatDisplayDate(range.toDate)}`
}

export function getOrderShiftRangeLabel(
    report: OrderShiftReportResponse | null,
    preset: RangePreset,
    selectedWeek?: WeekOption,
) {
    if (!report) {
        return getRangeLabelFromPreset(preset, selectedWeek)
    }

    return `${formatDisplayDate(report.startDate)} - ${formatDisplayDate(report.endDate)}`
}
