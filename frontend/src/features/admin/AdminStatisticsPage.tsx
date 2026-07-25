import {
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react'
import {useAdminSocket} from '@/realtime/useAdminSocket'
import {
    adminApi,
    categoryApi,
    type BestSellingDishItem,
    type CategoryResponse,
    type OrderShiftItem,
    type OrderShiftReportResponse,
    type RevenueReportResponse,
} from '@/shared/api/admin'

type ReportKey =
    | 'revenue'
    | 'categoryBestsellers'
    | 'bestsellers'
    | 'orderShifts'

type RangePreset = 'TODAY' | 'LAST_7' | 'CUSTOM_WEEK'

interface RevenueDashboardData {
    totalRevenue: RevenueReportResponse | null
    todayRevenue: RevenueReportResponse | null
    weeklyRevenue: RevenueReportResponse | null
    monthlyRevenue: RevenueReportResponse | null
    yearlyRevenue: RevenueReportResponse | null
    customRangeRevenue: RevenueReportResponse | null
}

interface WeekOption {
    value: string
    label: string
    fromDate: string
    toDate: string
}

interface ShiftViewItem extends OrderShiftItem {
    color: string
}

const emptyRevenueDashboardData: RevenueDashboardData = {
    totalRevenue: null,
    todayRevenue: null,
    weeklyRevenue: null,
    monthlyRevenue: null,
    yearlyRevenue: null,
    customRangeRevenue: null,
}

const shiftCatalog = [
    {
        shiftName: 'MORNING',
        displayName: 'Ca sáng',
        startTime: '08:00',
        endTime: '10:59',
        color: '#16a34a',
    },
    {
        shiftName: 'NOON',
        displayName: 'Ca trưa',
        startTime: '11:00',
        endTime: '13:59',
        color: '#22c55e',
    },
    {
        shiftName: 'AFTERNOON',
        displayName: 'Ca chiều',
        startTime: '14:00',
        endTime: '16:59',
        color: '#86efac',
    },
    {
        shiftName: 'EVENING',
        displayName: 'Ca tối',
        startTime: '17:00',
        endTime: '22:00',
        color: '#f97316',
    },
]

const vietnameseWeekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const vietnameseMonthLabels = Array.from(
    {
        length: 12,
    },
    (_, index) => `Tháng ${index + 1}`,
)


function formatDateForApi(date: Date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')

    return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number) {
    const nextDate = new Date(date)

    nextDate.setDate(nextDate.getDate() + amount)

    return nextDate
}

function getTodayRange() {
    const today = formatDateForApi(new Date())

    return {
        fromDate: today,
        toDate: today,
    }
}

function getLastSevenDayRange() {
    const today = new Date()

    return {
        fromDate: formatDateForApi(addDays(today, -6)),
        toDate: formatDateForApi(today),
    }
}

function getSundayOfWeek(date: Date) {
    const sunday = new Date(date)
    const day = sunday.getDay()
    const daysUntilSunday = day === 0 ? 0 : 7 - day

    sunday.setDate(sunday.getDate() + daysUntilSunday)

    return sunday
}

function getNextMonday(date: Date) {
    const nextMonday = new Date(date)
    const day = nextMonday.getDay()
    const daysUntilMonday = day === 0 ? 1 : 8 - day

    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)

    return nextMonday
}

function formatShortDate(date: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
    }).format(date)
}

function getYearOptions() {
    const currentYear = new Date().getFullYear()

    return Array.from(
        {
            length: 5,
        },
        (_, index) => currentYear - index,
    )
}

function buildWeekOptions(year: number): WeekOption[] {
    const today = new Date()
    const currentYear = today.getFullYear()
    const endOfYear = new Date(year, 11, 31)
    const options: WeekOption[] = []

    let weekStart = new Date(year, 0, 1)

    while (
        weekStart.getFullYear() === year
        && (year < currentYear || weekStart <= today)
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
            label: `${formatShortDate(weekStart)} - ${formatShortDate(
                boundedEnd,
            )}`,
            fromDate: formatDateForApi(weekStart),
            toDate: formatDateForApi(boundedEnd),
        })

        weekStart = getNextMonday(weekStart)
    }

    return options
}

function getDefaultWeek(year: number) {
    const options = buildWeekOptions(year)

    return options[options.length - 1] ?? {
        value: formatDateForApi(new Date()),
        label: formatShortDate(new Date()),
        fromDate: formatDateForApi(new Date()),
        toDate: formatDateForApi(new Date()),
    }
}

function getRangeFromPreset(
    preset: RangePreset,
    selectedWeek?: WeekOption,
) {
    if (preset === 'CUSTOM_WEEK') {
        return selectedWeek ?? getDefaultWeek(new Date().getFullYear())
    }

    return preset === 'TODAY' ? getTodayRange() : getLastSevenDayRange()
}

function formatDisplayDate(date: string) {
    const [year, month, day] = date.split('-')

    return `${day}/${month}/${year}`
}

function getCalendarMonthDate(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getCalendarDays(viewDate: Date) {
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

function isSameCalendarDate(firstDate: Date, secondDate: Date) {
    return (
        firstDate.getFullYear() === secondDate.getFullYear()
        && firstDate.getMonth() === secondDate.getMonth()
        && firstDate.getDate() === secondDate.getDate()
    )
}

function getCalendarYearOptions(viewYear: number) {
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

function formatRevenueCurrency(value?: number | null) {
    return `${new Intl.NumberFormat('vi-VN').format(value ?? 0)} ₫`
}

function formatNumber(value?: number | null) {
    return new Intl.NumberFormat('vi-VN').format(value ?? 0)
}

function getDishInitial(dishName: string) {
    return dishName.trim().charAt(0).toUpperCase() || '?'
}

function resolveDishImageSrc(imageUrl?: string | null) {
    const value = imageUrl?.trim()

    if (!value) {
        return null
    }

    if (
        value.startsWith('http')
        || value.startsWith('//')
        || value.startsWith('data:')
        || value.startsWith('/')
    ) {
        return value
    }

    return `/image/${value}`
}

function formatDecimal(value?: number | null) {
    return new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    }).format(value ?? 0)
}

function formatManualDateInput(value: string) {
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

function parseVietnameseDate(value: string) {
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
        parsedDate.getFullYear() !== year
        || parsedDate.getMonth() !== month - 1
        || parsedDate.getDate() !== day
    ) {
        return null
    }

    return parsedDate
}

function parseManualDateForApi(value: string) {
    const parsedDate = parseVietnameseDate(value)

    return parsedDate ? formatDateForApi(parsedDate) : null
}

function getApiErrorMessage(error: unknown, fallback: string) {
    if (typeof error !== 'object' || error === null) {
        return fallback
    }

    const response = (
        error as {
            response?: {
                data?: {
                    error?: string
                    message?: string
                }
            }
        }
    ).response

    return response?.data?.message ?? response?.data?.error ?? fallback
}

function getRangeLabelFromPreset(
    preset: RangePreset,
    selectedWeek?: WeekOption,
) {
    const range = getRangeFromPreset(preset, selectedWeek)

    return `${formatDisplayDate(range.fromDate)} - ${formatDisplayDate(
        range.toDate,
    )}`
}

function getOrderShiftRangeLabel(
    report: OrderShiftReportResponse | null,
    preset: RangePreset,
    selectedWeek?: WeekOption,
) {
    if (!report) {
        return getRangeLabelFromPreset(preset, selectedWeek)
    }

    return `${formatDisplayDate(report.startDate)} - ${formatDisplayDate(
        report.endDate,
    )}`
}

function buildShiftRows(
    report: OrderShiftReportResponse | null,
): ShiftViewItem[] {
    return shiftCatalog.map((shift) => {
        const apiShift = report?.shifts?.find(
            (item) => item.shiftName === shift.shiftName,
        )
        const fallbackShift =
            report?.highestOrderShift?.shiftName === shift.shiftName
                ? report.highestOrderShift
                : null

        return {
            ...shift,
            orderCount:
                apiShift?.orderCount ?? fallbackShift?.orderCount ?? 0,
            percentage:
                apiShift?.percentage ?? fallbackShift?.percentage ?? 0,
        }
    })
}

function buildDonutGradient(rows: ShiftViewItem[]) {
    const totalOrders = rows.reduce(
        (sum, row) => sum + row.orderCount,
        0,
    )

    if (totalOrders === 0) {
        return '#e5e7eb'
    }

    let cursor = 0

    return rows
        .map((row, index) => {
            const degrees =
                index === rows.length - 1
                    ? 360 - cursor
                    : (row.orderCount / totalOrders) * 360
            const nextCursor = cursor + degrees
            const segment = `${row.color} ${cursor}deg ${nextCursor}deg`

            cursor = nextCursor

            return segment
        })
        .join(', ')
}

function StatIcon({
                      children,
                      className,
                  }: {
    children: string
    className: string
}) {
    return (
        <span className={`rims-stat-card-icon-wrapper ${className}`}>
            <span>{children}</span>
        </span>
    )
}

function DongIcon() {
    return (
        <span
            aria-hidden="true"
            className="admin-revenue-card-icon"
        >
            ₫
        </span>
    )
}

function CalendarIcon() {
    return (
        <svg
            aria-hidden="true"
            className="admin-revenue-calendar-icon"
            viewBox="0 0 24 24"
        >
            <path d="M8 2v4"/>
            <path d="M16 2v4"/>
            <path d="M3 10h18"/>
            <path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
        </svg>
    )
}

function FileIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
        >
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/>
            <path d="M14 2v5h5"/>
            <path d="M9 13h6"/>
            <path d="M9 17h6"/>
        </svg>
    )
}

function TrophyIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
        >
            <path d="M8 21h8"/>
            <path d="M12 17v4"/>
            <path d="M7 4h10v4a5 5 0 0 1-10 0z"/>
            <path d="M7 6H4a2 2 0 0 0 2 4h1"/>
            <path d="M17 6h3a2 2 0 0 1-2 4h-1"/>
        </svg>
    )
}

function CrownIcon() {
    return (
        <svg
            aria-hidden="true"
            className="bestseller-rank-crown"
            viewBox="0 0 24 24"
        >
            <path d="m3 8 4 3 5-7 5 7 4-3-2 10H5z"/>
            <path d="M5 18h14"/>
        </svg>
    )
}

function TrendingIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
        >
            <path d="M3 17 9 11l4 4 7-8"/>
            <path d="M14 7h6v6"/>
        </svg>
    )
}

function StatisticsReportSelector({
                                      activeReport,
                                      totalRevenue,
                                      bestSellerCount,
                                      highestShiftName,
                                      onSelectReport,
                                  }: {
    activeReport: ReportKey
    totalRevenue?: number | null
    bestSellerCount: number
    highestShiftName?: string | null
    onSelectReport: (report: ReportKey) => void
}) {
    return (
        <section className="rims-stats-cards-grid">
            <button
                className={
                    activeReport === 'revenue'
                        ? 'rims-stat-card active'
                        : 'rims-stat-card'
                }
                type="button"
                onClick={() => onSelectReport('revenue')}
            >
                <StatIcon className="icon-revenue">VND</StatIcon>
                <div className="rims-stat-card-body">
                    <h3>Báo cáo tổng doanh thu</h3>
                    <p>{formatRevenueCurrency(totalRevenue)}</p>
                </div>
                <span className="rims-stat-card-action">›</span>
            </button>

            <button
                className={
                    activeReport === 'categoryBestsellers'
                        ? 'rims-stat-card active'
                        : 'rims-stat-card'
                }
                type="button"
                onClick={() => onSelectReport('categoryBestsellers')}
            >
                <StatIcon className="icon-category-bestsellers">DM</StatIcon>
                <div className="rims-stat-card-body">
                    <h3>Lọc món bán chạy theo danh mục</h3>
                </div>
                <span className="rims-stat-card-action">›</span>
            </button>

            <button
                className={
                    activeReport === 'bestsellers'
                        ? 'rims-stat-card active'
                        : 'rims-stat-card'
                }
                type="button"
                onClick={() => onSelectReport('bestsellers')}
            >
                <StatIcon className="icon-bestsellers">Top</StatIcon>
                <div className="rims-stat-card-body">
                    <h3>Món bán chạy</h3>
                    <p>{formatNumber(bestSellerCount)} món đang có dữ liệu</p>
                </div>
                <span className="rims-stat-card-action">›</span>
            </button>

            <button
                className={
                    activeReport === 'orderShifts'
                        ? 'rims-stat-card highlighted active'
                        : 'rims-stat-card highlighted'
                }
                type="button"
                onClick={() => onSelectReport('orderShifts')}
            >
                <StatIcon className="icon-order-shifts">Ca</StatIcon>
                <div className="rims-stat-card-body">
                    <h3>Thống kê đơn hàng theo ca</h3>
                    <p>{highestShiftName ?? 'Ca có nhiều đơn nhất'}</p>
                </div>
                <span className="rims-stat-card-action">›</span>
            </button>
        </section>
    )
}

function RevenueCard({
                         title,
                         amount,
                         className = '',
                     }: {
    title: string
    amount?: number | null
    className?: string
}) {
    return (
        <article className={`admin-revenue-card ${className}`.trim()}>
            <div className="admin-revenue-card-header">
                <span>{title}</span>
                <DongIcon/>
            </div>

            <strong>{formatRevenueCurrency(amount)}</strong>
        </article>
    )
}

function RevenueDateInput({
                              id,
                              label,
                              value,
                              onChange,
                          }: {
    id: string
    label: string
    value: string
    onChange: (value: string) => void
}) {
    const fieldRef = useRef<HTMLDivElement | null>(null)
    const selectedDate = parseVietnameseDate(value)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [calendarDate, setCalendarDate] = useState(() =>
        getCalendarMonthDate(selectedDate ?? new Date()),
    )
    const calendarDays = getCalendarDays(calendarDate)
    const calendarYearOptions = getCalendarYearOptions(
        calendarDate.getFullYear(),
    )

    useEffect(() => {
        if (!isCalendarOpen) {
            return undefined
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (fieldRef.current?.contains(event.target as Node)) {
                return
            }

            setIsCalendarOpen(false)
        }

        document.addEventListener('mousedown', handlePointerDown)

        return () =>
            document.removeEventListener('mousedown', handlePointerDown)
    }, [isCalendarOpen])

    function openCalendar() {
        const parsedDate = parseVietnameseDate(value)

        if (parsedDate) {
            setCalendarDate(getCalendarMonthDate(parsedDate))
        }

        setIsCalendarOpen(true)
    }

    function handleManualChange(inputValue: string) {
        const formattedValue = formatManualDateInput(inputValue)
        const parsedDate = parseVietnameseDate(formattedValue)

        onChange(formattedValue)

        if (parsedDate) {
            setCalendarDate(getCalendarMonthDate(parsedDate))
        }
    }

    function handleDateSelect(date: Date) {
        onChange(formatDisplayDate(formatDateForApi(date)))
        setCalendarDate(getCalendarMonthDate(date))
        setIsCalendarOpen(false)
    }

    function handleMonthChange(month: number) {
        setCalendarDate(
            (currentDate) =>
                new Date(currentDate.getFullYear(), month, 1),
        )
    }

    function handleYearChange(year: number) {
        setCalendarDate(
            (currentDate) =>
                new Date(year, currentDate.getMonth(), 1),
        )
    }

    function handleCalendarKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            setIsCalendarOpen(false)
        }
    }

    return (
        <div
            className="admin-revenue-date-field"
            ref={fieldRef}
        >
            <label htmlFor={id}>{label}</label>

            <span className="admin-revenue-date-input-shell">
                <input
                    aria-label={`${label} dạng ngày/tháng/năm`}
                    id={id}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="dd/mm/yyyy"
                    type="text"
                    value={value}
                    onChange={(event) => handleManualChange(event.target.value)}
                    onFocus={openCalendar}
                    onKeyDown={handleCalendarKeyDown}
                />

                <button
                    aria-label={`Mở lịch ${label}`}
                    className="admin-revenue-calendar-trigger"
                    type="button"
                    onClick={openCalendar}
                >
                    <CalendarIcon/>
                </button>
            </span>

            {isCalendarOpen && (
                <div
                    aria-label={`Lịch chọn ${label}`}
                    className="admin-revenue-date-picker"
                    role="dialog"
                    onKeyDown={handleCalendarKeyDown}
                >
                    <div className="admin-revenue-calendar-nav">
                        <button
                            aria-label="Chuyển đến tháng trước"
                            className="admin-revenue-calendar-nav-button"
                            type="button"
                            onClick={() =>
                                setCalendarDate(
                                    (currentDate) =>
                                        new Date(
                                            currentDate.getFullYear(),
                                            currentDate.getMonth() - 1,
                                            1,
                                        ),
                                )
                            }
                        >
                            &lsaquo;
                        </button>

                        <div className="admin-revenue-calendar-title">
                            <select
                                aria-label="Chọn tháng"
                                value={calendarDate.getMonth()}
                                onChange={(event) =>
                                    handleMonthChange(
                                        Number(event.target.value),
                                    )
                                }
                            >
                                {vietnameseMonthLabels.map(
                                    (monthLabel, monthIndex) => (
                                        <option
                                            key={monthLabel}
                                            value={monthIndex}
                                        >
                                            {monthLabel}
                                        </option>
                                    ),
                                )}
                            </select>

                            <span>năm</span>

                            <select
                                aria-label="Chọn năm"
                                value={calendarDate.getFullYear()}
                                onChange={(event) =>
                                    handleYearChange(
                                        Number(event.target.value),
                                    )
                                }
                            >
                                {calendarYearOptions.map((year) => (
                                    <option
                                        key={year}
                                        value={year}
                                    >
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            aria-label="Chuyển đến tháng tiếp theo"
                            className="admin-revenue-calendar-nav-button"
                            type="button"
                            onClick={() =>
                                setCalendarDate(
                                    (currentDate) =>
                                        new Date(
                                            currentDate.getFullYear(),
                                            currentDate.getMonth() + 1,
                                            1,
                                        ),
                                )
                            }
                        >
                            &rsaquo;
                        </button>
                    </div>

                    <div
                        aria-hidden="true"
                        className="admin-revenue-calendar-weekdays"
                    >
                        {vietnameseWeekdayLabels.map((weekdayLabel) => (
                            <span key={weekdayLabel}>{weekdayLabel}</span>
                        ))}
                    </div>

                    <div className="admin-revenue-calendar-grid">
                        {calendarDays.map((date) => {
                            const dateValue = formatDateForApi(date)
                            const displayDate = formatDisplayDate(dateValue)
                            const isCurrentMonth =
                                date.getFullYear()
                                === calendarDate.getFullYear()
                                && date.getMonth()
                                === calendarDate.getMonth()
                            const isSelected =
                                selectedDate
                                && isSameCalendarDate(date, selectedDate)
                            const isToday = isSameCalendarDate(
                                date,
                                new Date(),
                            )
                            const className = [
                                'admin-revenue-calendar-day',
                                isCurrentMonth ? '' : 'outside-month',
                                isSelected ? 'selected' : '',
                                isToday ? 'today' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')

                            return (
                                <button
                                    aria-label={`Chọn ngày ${displayDate}`}
                                    className={className}
                                    key={dateValue}
                                    type="button"
                                    onClick={() => handleDateSelect(date)}
                                >
                                    {date.getDate()}
                                </button>
                            )
                        })}
                    </div>

                    <div className="admin-revenue-calendar-footer">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('')
                                setIsCalendarOpen(false)
                            }}
                        >
                            Xóa
                        </button>

                        <button
                            type="button"
                            onClick={() => handleDateSelect(new Date())}
                        >
                            Hôm nay
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function PresetButtonGroup({
                               activePreset,
                               selectedWeek,
                               selectedYear,
                               weekOptions,
                               yearOptions,
                               isLoading,
                               onChange,
                               onWeekChange,
                               onYearChange,
                           }: {
    activePreset: RangePreset
    selectedWeek: WeekOption
    selectedYear: number
    weekOptions: WeekOption[]
    yearOptions: number[]
    isLoading: boolean
    onChange: (preset: RangePreset) => void
    onWeekChange: (weekValue: string) => void
    onYearChange: (year: number) => void
}) {
    return (
        <div
            className={
                activePreset === 'CUSTOM_WEEK'
                    ? 'admin-range-filter-shell expanded'
                    : 'admin-range-filter-shell'
            }
        >
            <div className="rims-btn-group">
                <button
                    className={
                        activePreset === 'TODAY'
                            ? 'rims-btn-tab active'
                            : 'rims-btn-tab'
                    }
                    disabled={isLoading}
                    type="button"
                    onClick={() => onChange('TODAY')}
                >
                    Hôm nay
                </button>
                <button
                    className={
                        activePreset === 'LAST_7'
                            ? 'rims-btn-tab active'
                            : 'rims-btn-tab'
                    }
                    disabled={isLoading}
                    type="button"
                    onClick={() => onChange('LAST_7')}
                >
                    7 ngày gần nhất
                </button>
                <button
                    className={
                        activePreset === 'CUSTOM_WEEK'
                            ? 'rims-btn-tab active'
                            : 'rims-btn-tab'
                    }
                    disabled={isLoading}
                    type="button"
                    onClick={() => onChange('CUSTOM_WEEK')}
                >
                    Tùy chọn
                </button>
            </div>

            {activePreset === 'CUSTOM_WEEK' && (
                <div className="admin-week-selector">
                    <label>
                        <span>Năm</span>
                        <select
                            disabled={isLoading}
                            value={selectedYear}
                            onChange={(event) =>
                                onYearChange(Number(event.target.value))
                            }
                        >
                            {yearOptions.map((year) => (
                                <option
                                    key={year}
                                    value={year}
                                >
                                    {year}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span>Tuần</span>
                        <select
                            disabled={isLoading}
                            value={selectedWeek.value}
                            onChange={(event) =>
                                onWeekChange(event.target.value)
                            }
                        >
                            {weekOptions.map((week) => (
                                <option
                                    key={week.value}
                                    value={week.value}
                                >
                                    {week.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}
        </div>
    )
}

function RevenueDashboard({
                              data,
                              fromDate,
                              toDate,
                              isLoading,
                              isCustomLoading,
                              error,
                              customRangeError,
                              onFromDateChange,
                              onToDateChange,
                              onReload,
                              onApplyCustomRange,
                          }: {
    data: RevenueDashboardData
    fromDate: string
    toDate: string
    isLoading: boolean
    isCustomLoading: boolean
    error: string | null
    customRangeError: string | null
    onFromDateChange: (value: string) => void
    onToDateChange: (value: string) => void
    onReload: () => void
    onApplyCustomRange: () => void
}) {
    return (
        <section className="admin-revenue-dashboard">
            <header className="admin-revenue-dashboard-header">
                <h2>Báo cáo tổng doanh thu</h2>
                <p>Tổng quan doanh thu hiện tại.</p>
            </header>

            {error && (
                <div className="admin-revenue-alert">
                    <span>{error}</span>
                    <button
                        disabled={isLoading}
                        type="button"
                        onClick={onReload}
                    >
                        Thử lại
                    </button>
                </div>
            )}

            <div
                aria-busy={isLoading}
                className="admin-revenue-card-row"
            >
                <RevenueCard
                    amount={data.totalRevenue?.revenue}
                    title="Tổng doanh thu"
                />
                <RevenueCard
                    amount={data.todayRevenue?.revenue}
                    title="Doanh thu hôm nay"
                />
                <RevenueCard
                    amount={data.weeklyRevenue?.revenue}
                    title="Doanh thu tuần"
                />
                <RevenueCard
                    amount={data.monthlyRevenue?.revenue}
                    title="Doanh thu tháng"
                />
                <RevenueCard
                    amount={data.yearlyRevenue?.revenue}
                    title="Doanh thu năm"
                />
            </div>

            <section className="admin-revenue-filter-panel">
                <h3>Bộ lọc khoảng ngày tùy chỉnh</h3>

                <form
                    className="admin-revenue-filter-content"
                    onSubmit={(event) => {
                        event.preventDefault()
                        onApplyCustomRange()
                    }}
                >
                    <div className="admin-revenue-filter-left">
                        <div className="admin-revenue-filter-controls">
                            <RevenueDateInput
                                id="admin-revenue-from-date"
                                label="Từ ngày"
                                value={fromDate}
                                onChange={onFromDateChange}
                            />

                            <RevenueDateInput
                                id="admin-revenue-to-date"
                                label="Đến ngày"
                                value={toDate}
                                onChange={onToDateChange}
                            />

                            <button
                                className="admin-revenue-apply-button"
                                disabled={isCustomLoading}
                                type="submit"
                            >
                                {isCustomLoading
                                    ? 'Đang áp dụng...'
                                    : 'Áp dụng khoảng ngày'}
                            </button>
                        </div>

                        {customRangeError && (
                            <p className="admin-revenue-filter-error">
                                {customRangeError}
                            </p>
                        )}
                    </div>

                    <RevenueCard
                        amount={data.customRangeRevenue?.revenue}
                        className="admin-revenue-custom-card"
                        title="Doanh thu khoảng ngày"
                    />
                </form>
            </section>
        </section>
    )
}

function BestSellerDishImage({
                                 dishName,
                                 imageUrl,
                             }: {
    dishName: string
    imageUrl?: string | null
}) {
    const [hasError, setHasError] = useState(false)
    const imageSrc = resolveDishImageSrc(imageUrl)

    if (!imageSrc || hasError) {
        return (
            <span className="bestseller-item-avatar bestseller-item-avatar-fallback">
                {getDishInitial(dishName)}
            </span>
        )
    }

    return (
        <img
            alt={dishName}
            className="bestseller-item-avatar"
            src={imageSrc}
            onError={() => setHasError(true)}
        />
    )
}

function BestSellersReport({
                               title = 'Món bán chạy',
                               subtitle = 'Báo cáo món ăn bán chạy theo khoảng thời gian.',
                               items,
                               preset,
                               selectedWeek,
                               selectedYear,
                               weekOptions,
                               yearOptions,
                               categories,
                               selectedCategoryId,
                               isLoading,
                               error,
                               onCategoryChange,
                               onPresetChange,
                               onWeekChange,
                               onYearChange,
                           }: {
    title?: string
    subtitle?: string
    items: BestSellingDishItem[]
    preset: RangePreset
    selectedWeek: WeekOption
    selectedYear: number
    weekOptions: WeekOption[]
    yearOptions: number[]
    categories?: CategoryResponse[]
    selectedCategoryId?: string
    isLoading: boolean
    error: string | null
    onCategoryChange?: (categoryId: string) => void
    onPresetChange: (preset: RangePreset) => void
    onWeekChange: (weekValue: string) => void
    onYearChange: (year: number) => void
}) {
    const maxQuantity = Math.max(
        ...items.map((item) => item.totalQuantity),
        1,
    )

    return (
        <section className="order-shift-dashboard-panel admin-bestseller-dashboard-panel">
            <header className="order-shift-dashboard-header">
                <div>
                    <h2>{title}</h2>
                    <p className="rims-report-subtitle">
                        {subtitle}
                    </p>
                </div>

                <div className="order-shift-filter-area">
                    <PresetButtonGroup
                        activePreset={preset}
                        isLoading={isLoading}
                        selectedWeek={selectedWeek}
                        selectedYear={selectedYear}
                        weekOptions={weekOptions}
                        yearOptions={yearOptions}
                        onChange={onPresetChange}
                        onWeekChange={onWeekChange}
                        onYearChange={onYearChange}
                    />
                </div>
            </header>

            {categories && selectedCategoryId && onCategoryChange && (
                <div className="admin-bestseller-category-filter-row">
                    <label className="admin-bestseller-category-filter">
                        <span>Danh mục</span>
                        <select
                            disabled={isLoading || categories.length === 0}
                            value={selectedCategoryId}
                            onChange={(event) =>
                                onCategoryChange(event.target.value)
                            }
                        >
                            {categories.length === 0 ? (
                                <option value="ALL">
                                    Chưa có danh mục
                                </option>
                            ) : (
                                categories.map((category) => (
                                    <option
                                        key={category.id}
                                        value={String(category.id)}
                                    >
                                        {category.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </label>
                </div>
            )}

            {error && (
                <p className="revenue-comparison-error">
                    {error}
                </p>
            )}

            <section className="rims-bestsellers-list-section">
                {isLoading ? (
                    <div className="rims-empty-report">
                        Đang tải dữ liệu món bán chạy...
                    </div>
                ) : items.length === 0 ? (
                    <div className="rims-empty-report">
                        Chưa có dữ liệu món bán chạy trong khoảng này.
                    </div>
                ) : (
                    items.map((item, index) => {
                        const rank = item.rank ?? index + 1

                        return (
                            <article
                                className={
                                    rank === 1
                                        ? 'bestseller-item-card is-top'
                                        : 'bestseller-item-card'
                                }
                                key={`${rank}-${item.dishName}`}
                            >
                                <span
                                    className={`item-rank-badge rank-${Math.min(
                                        rank,
                                        3,
                                    )}`}
                                >
                                    {rank === 1 && <CrownIcon/>}
                                    <span>{rank}</span>
                                </span>
                                <BestSellerDishImage
                                    dishName={item.dishName}
                                    imageUrl={item.imageUrl}
                                />
                                <div className="item-info">
                                    <div className="item-title-row">
                                        <strong>{item.dishName}</strong>
                                        <span className="item-category-tag">
                                            {formatRevenueCurrency(
                                                item.totalRevenue,
                                            )}
                                        </span>
                                    </div>

                                    <div className="item-visual-bar-container">
                                        <div
                                            className="item-bar-fill"
                                            style={{
                                                width: `${Math.max(
                                                    8,
                                                    (item.totalQuantity
                                                        / maxQuantity)
                                                    * 100,
                                                )}%`,
                                            }}
                                        />
                                    </div>

                                    <div className="item-metric-row">
                                        <span>Số lượng</span>
                                        <strong>
                                            {formatNumber(item.totalQuantity)}
                                        </strong>
                                    </div>
                                </div>
                            </article>
                        )
                    })
                )}
            </section>
        </section>
    )
}

function OrderShiftDashboard({
                                 report,
                                 preset,
                                 selectedWeek,
                                 selectedYear,
                                 weekOptions,
                                 yearOptions,
                                 isLoading,
                                 error,
                                 onPresetChange,
                                 onWeekChange,
                                 onYearChange,
                             }: {
    report: OrderShiftReportResponse | null
    preset: RangePreset
    selectedWeek: WeekOption
    selectedYear: number
    weekOptions: WeekOption[]
    yearOptions: number[]
    isLoading: boolean
    error: string | null
    onPresetChange: (preset: RangePreset) => void
    onWeekChange: (weekValue: string) => void
    onYearChange: (year: number) => void
}) {
    const rows = buildShiftRows(report)
    const donutGradient = buildDonutGradient(rows)
    const totalOrders = report?.totalPaidOrders ?? 0
    const averageOrdersPerDay = report?.averageOrdersPerDay ?? 0
    const highestShift = rows.find(
        (row) => row.shiftName === report?.highestOrderShift?.shiftName,
    )

    return (
        <section className="order-shift-dashboard-panel">
            <header className="order-shift-dashboard-header">
                <div>
                    <h2>Thống kê đơn hàng theo ca</h2>
                    <p className="rims-report-subtitle">
                        Báo cáo đơn hàng đã thanh toán theo từng ca.
                    </p>
                </div>

                <div className="order-shift-filter-area">
                    <PresetButtonGroup
                        activePreset={preset}
                        isLoading={isLoading}
                        selectedWeek={selectedWeek}
                        selectedYear={selectedYear}
                        weekOptions={weekOptions}
                        yearOptions={yearOptions}
                        onChange={onPresetChange}
                        onWeekChange={onWeekChange}
                        onYearChange={onYearChange}
                    />
                </div>
            </header>

            {error && (
                <p className="revenue-comparison-error">
                    {error}
                </p>
            )}

            <div className="order-shift-kpi-grid">
                <article className="order-shift-kpi-card">
                    <span className="order-shift-kpi-icon icon-green">
                        <FileIcon/>
                    </span>
                    <div>
                        <span>Tổng đơn đã thanh toán</span>
                        <strong>{formatNumber(totalOrders)} đơn</strong>
                    </div>
                </article>

                <article className="order-shift-kpi-card featured">
                    <span className="order-shift-kpi-icon icon-orange">
                        <TrophyIcon/>
                    </span>
                    <div>
                        <span>Ca có nhiều đơn nhất</span>
                        <strong>
                            {highestShift?.displayName
                                ?? 'Chưa có dữ liệu'}
                        </strong>
                        <small>
                            {formatNumber(highestShift?.orderCount ?? 0)} đơn
                            {' '}• {formatDecimal(
                            highestShift?.percentage ?? 0,
                        )}
                            %
                        </small>
                    </div>
                </article>

                <article className="order-shift-kpi-card">
                    <span className="order-shift-kpi-icon icon-green">
                        <TrendingIcon/>
                    </span>
                    <div>
                        <span>Trung bình mỗi ngày</span>
                        <strong>
                            {formatDecimal(averageOrdersPerDay)} đơn
                        </strong>
                    </div>
                </article>
            </div>

            {isLoading ? (
                <div className="rims-empty-report">
                    Đang tải dữ liệu đơn hàng theo ca...
                </div>
            ) : (
                <div className="order-shift-detail-grid">
                    <section className="order-shift-detail-card">
                        <h3>Chi tiết theo ca</h3>

                        <div className="order-shift-table">
                            <div className="order-shift-table-head">
                                <span>Ca</span>
                                <span>Thời gian</span>
                                <span>Số đơn đã thanh toán</span>
                                <span>Tỷ trọng</span>
                            </div>

                            {rows.map((row) => (
                                <div
                                    className={
                                        row.shiftName
                                        === highestShift?.shiftName
                                            ? 'order-shift-table-row highlighted'
                                            : 'order-shift-table-row'
                                    }
                                    key={row.shiftName}
                                >
                                    <span>{row.displayName}</span>
                                    <span>
                                        {row.startTime} - {row.endTime}
                                    </span>
                                    <span>
                                        {formatNumber(row.orderCount)} đơn
                                    </span>
                                    <span>
                                        {formatDecimal(row.percentage)}%
                                    </span>
                                </div>
                            ))}

                            <div className="order-shift-table-row total">
                                <span>Tổng</span>
                                <span>
                                    {getOrderShiftRangeLabel(
                                        report,
                                        preset,
                                        selectedWeek,
                                    )}
                                </span>
                                <span>{formatNumber(totalOrders)} đơn</span>
                                <span>{totalOrders > 0 ? '100%' : '0%'}</span>
                            </div>
                        </div>
                    </section>

                    <section className="order-shift-detail-card chart-card">
                        <h3>Tỷ trọng đơn theo ca</h3>

                        <div className="order-shift-donut-layout">
                            <div
                                className="order-shift-donut"
                                style={{
                                    background: `conic-gradient(from -90deg, ${donutGradient})`,
                                }}
                            >
                                <div className="order-shift-donut-hole">
                                    <strong>{formatNumber(totalOrders)}</strong>
                                    <span>đơn</span>
                                </div>
                            </div>

                            <div className="order-shift-legend">
                                {rows.map((row) => (
                                    <div
                                        className="order-shift-legend-item"
                                        key={row.shiftName}
                                    >
                                        <span
                                            className="legend-color"
                                            style={{
                                                background: row.color,
                                            }}
                                        />
                                        <div>
                                            <strong>{row.displayName}</strong>
                                            <span>
                                                {formatDecimal(row.percentage)}
                                                % •{' '}
                                                {formatNumber(row.orderCount)}
                                                {' '}đơn
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </section>
    )
}

export default function AdminStatisticsPage() {
    const [activeReport, setActiveReport] =
        useState<ReportKey>('revenue')
    const [revenueData, setRevenueData] =
        useState<RevenueDashboardData>(emptyRevenueDashboardData)
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [revenueError, setRevenueError] = useState<string | null>(null)
    const [customRangeError, setCustomRangeError] =
        useState<string | null>(null)
    const [isRevenueLoading, setIsRevenueLoading] = useState(true)
    const [isCustomLoading, setIsCustomLoading] = useState(false)

    const [categories, setCategories] = useState<CategoryResponse[]>([])
    const [categoryBestSellingPreset, setCategoryBestSellingPreset] =
        useState<RangePreset>('LAST_7')
    const [categoryBestSellingYear, setCategoryBestSellingYear] =
        useState(() => new Date().getFullYear())
    const [
        selectedCategoryBestSellingWeek,
        setSelectedCategoryBestSellingWeek,
    ] =
        useState<WeekOption>(() =>
            getDefaultWeek(new Date().getFullYear()),
        )
    const [selectedBestSellingCategoryId, setSelectedBestSellingCategoryId] =
        useState('ALL')
    const [categoryBestSellers, setCategoryBestSellers] =
        useState<BestSellingDishItem[]>([])
    const [categoryBestSellingError, setCategoryBestSellingError] =
        useState<string | null>(null)
    const [isCategoryBestSellingLoading, setIsCategoryBestSellingLoading] =
        useState(false)

    const [bestSellingPreset, setBestSellingPreset] =
        useState<RangePreset>('LAST_7')
    const [bestSellingYear, setBestSellingYear] =
        useState(() => new Date().getFullYear())
    const [selectedBestSellingWeek, setSelectedBestSellingWeek] =
        useState<WeekOption>(() =>
            getDefaultWeek(new Date().getFullYear()),
        )
    const [bestSellers, setBestSellers] = useState<BestSellingDishItem[]>([])
    const [bestSellingError, setBestSellingError] =
        useState<string | null>(null)
    const [isBestSellingLoading, setIsBestSellingLoading] =
        useState(false)

    const [orderShiftPreset, setOrderShiftPreset] =
        useState<RangePreset>('LAST_7')
    const [orderShiftYear, setOrderShiftYear] =
        useState(() => new Date().getFullYear())
    const [selectedOrderShiftWeek, setSelectedOrderShiftWeek] =
        useState<WeekOption>(() =>
            getDefaultWeek(new Date().getFullYear()),
        )
    const [orderShiftReport, setOrderShiftReport] =
        useState<OrderShiftReportResponse | null>(null)
    const [orderShiftError, setOrderShiftError] =
        useState<string | null>(null)
    const [isOrderShiftLoading, setIsOrderShiftLoading] = useState(false)
    const yearOptions = getYearOptions()
    const categoryBestSellingWeekOptions = buildWeekOptions(
        categoryBestSellingYear,
    )
    const bestSellingWeekOptions = buildWeekOptions(bestSellingYear)
    const orderShiftWeekOptions = buildWeekOptions(orderShiftYear)

    useAdminSocket(() => {
        void loadRevenueDashboard(false)
        void loadCategoryBestSellingReport(
            categoryBestSellingPreset,
            selectedCategoryBestSellingWeek,
            selectedBestSellingCategoryId,
            false,
        )
        void loadBestSellingReport(bestSellingPreset, selectedBestSellingWeek, false)
        void loadOrderShiftReport(orderShiftPreset, selectedOrderShiftWeek, false)
    })

    useEffect(() => {
        const controller = new AbortController()

        void Promise.all([
            loadRevenueDashboard(true, controller.signal),
            loadCategoryBestSellingCategories(true, controller.signal),
            loadBestSellingReport(
                bestSellingPreset,
                selectedBestSellingWeek,
                true,
                controller.signal,
            ),
            loadOrderShiftReport(
                orderShiftPreset,
                selectedOrderShiftWeek,
                true,
                controller.signal,
            ),
        ])

        return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function loadRevenueDashboard(
        showFullLoading = true,
        signal?: AbortSignal,
    ) {
        try {
            if (showFullLoading) {
                setIsRevenueLoading(true)
            }
            setRevenueError(null)

            const [
                totalRevenue,
                todayRevenue,
                weeklyRevenue,
                monthlyRevenue,
                yearlyRevenue,
            ] = await Promise.all([
                adminApi.getTotalRevenue(signal),
                adminApi.getTodayRevenue(signal),
                adminApi.getWeeklyRevenue(signal),
                adminApi.getMonthlyRevenue(signal),
                adminApi.getYearlyRevenue(signal),
            ])

            setRevenueData((currentData) => ({
                ...currentData,
                totalRevenue: totalRevenue.data,
                todayRevenue: todayRevenue.data,
                weeklyRevenue: weeklyRevenue.data,
                monthlyRevenue: monthlyRevenue.data,
                yearlyRevenue: yearlyRevenue.data,
            }))
        } catch (error) {
            if (signal?.aborted) {
                return
            }

            console.error(error)
            setRevenueError(
                getApiErrorMessage(
                    error,
                    'Không thể tải báo cáo doanh thu.',
                ),
            )
        } finally {
            if (showFullLoading && !signal?.aborted) {
                setIsRevenueLoading(false)
            }
        }
    }

    async function loadCategoryBestSellingCategories(
        showFullLoading = true,
        signal?: AbortSignal,
    ) {
        try {
            const {data} = await categoryApi.getAllCategories(signal)
            const nextCategories = data ?? []
            const defaultCategoryId =
                nextCategories[0]?.id != null
                    ? String(nextCategories[0].id)
                    : 'ALL'

            setCategories(nextCategories)
            setSelectedBestSellingCategoryId(defaultCategoryId)

            await loadCategoryBestSellingReport(
                categoryBestSellingPreset,
                selectedCategoryBestSellingWeek,
                defaultCategoryId,
                showFullLoading,
                signal,
            )
        } catch (error) {
            if (signal?.aborted) {
                return
            }

            console.error(error)
            setCategoryBestSellingError(
                getApiErrorMessage(
                    error,
                    'Không thể tải danh mục món ăn.',
                ),
            )
        }
    }

    async function loadCategoryBestSellingReport(
        preset: RangePreset,
        selectedWeek: WeekOption = selectedCategoryBestSellingWeek,
        categoryIdValue: string = selectedBestSellingCategoryId,
        showFullLoading = true,
        signal?: AbortSignal,
    ) {
        const range = getRangeFromPreset(preset, selectedWeek)
        const parsedCategoryId =
            categoryIdValue === 'ALL'
                ? null
                : Number(categoryIdValue)
        const categoryId =
            parsedCategoryId !== null && Number.isFinite(parsedCategoryId)
                ? parsedCategoryId
                : null

        try {
            if (showFullLoading) {
                setIsCategoryBestSellingLoading(true)
            }
            setCategoryBestSellingError(null)

            const {data} = await adminApi.getBestSellingReportBetween(
                range.fromDate,
                range.toDate,
                categoryId,
                signal,
            )

            setCategoryBestSellers(data.items ?? [])
        } catch (error) {
            if (signal?.aborted) {
                return
            }

            console.error(error)
            setCategoryBestSellingError(
                getApiErrorMessage(
                    error,
                    'Không thể tải top món bán chạy theo danh mục.',
                ),
            )
        } finally {
            if (showFullLoading && !signal?.aborted) {
                setIsCategoryBestSellingLoading(false)
            }
        }
    }

    async function loadBestSellingReport(
        preset: RangePreset,
        selectedWeek: WeekOption = selectedBestSellingWeek,
        showFullLoading = true,
        signal?: AbortSignal,
    ) {
        const range = getRangeFromPreset(preset, selectedWeek)

        try {
            if (showFullLoading) {
                setIsBestSellingLoading(true)
            }
            setBestSellingError(null)

            const {data} = await adminApi.getBestSellingReportBetween(
                range.fromDate,
                range.toDate,
                undefined,
                signal,
            )

            setBestSellers(data.items ?? [])
        } catch (error) {
            if (signal?.aborted) {
                return
            }

            console.error(error)
            setBestSellingError(
                getApiErrorMessage(
                    error,
                    'Không thể tải dữ liệu món bán chạy.',
                ),
            )
        } finally {
            if (showFullLoading && !signal?.aborted) {
                setIsBestSellingLoading(false)
            }
        }
    }

    async function loadOrderShiftReport(
        preset: RangePreset,
        selectedWeek: WeekOption = selectedOrderShiftWeek,
        showFullLoading = true,
        signal?: AbortSignal,
    ) {
        const range = getRangeFromPreset(preset, selectedWeek)

        try {
            if (showFullLoading) {
                setIsOrderShiftLoading(true)
            }
            setOrderShiftError(null)

            const {data} = await adminApi.getOrderShiftReportBetween(
                range.fromDate,
                range.toDate,
                signal,
            )

            setOrderShiftReport(data)
        } catch (error) {
            if (signal?.aborted) {
                return
            }

            console.error(error)
            setOrderShiftError(
                getApiErrorMessage(
                    error,
                    'Không thể tải dữ liệu thống kê đơn hàng theo ca.',
                ),
            )
        } finally {
            if (showFullLoading && !signal?.aborted) {
                setIsOrderShiftLoading(false)
            }
        }
    }

    function handleCategoryBestSellingPresetChange(preset: RangePreset) {
        setCategoryBestSellingPreset(preset)
        void loadCategoryBestSellingReport(
            preset,
            selectedCategoryBestSellingWeek,
            selectedBestSellingCategoryId,
        )
    }

    function handleCategoryBestSellingYearChange(year: number) {
        const nextWeek = getDefaultWeek(year)

        setCategoryBestSellingYear(year)
        setSelectedCategoryBestSellingWeek(nextWeek)
        setCategoryBestSellingPreset('CUSTOM_WEEK')
        void loadCategoryBestSellingReport(
            'CUSTOM_WEEK',
            nextWeek,
            selectedBestSellingCategoryId,
        )
    }

    function handleCategoryBestSellingWeekChange(weekValue: string) {
        const nextWeek = categoryBestSellingWeekOptions.find(
            (week) => week.value === weekValue,
        )

        if (!nextWeek) {
            return
        }

        setSelectedCategoryBestSellingWeek(nextWeek)
        setCategoryBestSellingPreset('CUSTOM_WEEK')
        void loadCategoryBestSellingReport(
            'CUSTOM_WEEK',
            nextWeek,
            selectedBestSellingCategoryId,
        )
    }

    function handleBestSellingCategoryChange(categoryId: string) {
        setSelectedBestSellingCategoryId(categoryId)
        void loadCategoryBestSellingReport(
            categoryBestSellingPreset,
            selectedCategoryBestSellingWeek,
            categoryId,
        )
    }

    function handleBestSellingPresetChange(preset: RangePreset) {
        setBestSellingPreset(preset)
        void loadBestSellingReport(preset, selectedBestSellingWeek)
    }

    function handleBestSellingYearChange(year: number) {
        const nextWeek = getDefaultWeek(year)

        setBestSellingYear(year)
        setSelectedBestSellingWeek(nextWeek)
        setBestSellingPreset('CUSTOM_WEEK')
        void loadBestSellingReport('CUSTOM_WEEK', nextWeek)
    }

    function handleBestSellingWeekChange(weekValue: string) {
        const nextWeek = bestSellingWeekOptions.find(
            (week) => week.value === weekValue,
        )

        if (!nextWeek) {
            return
        }

        setSelectedBestSellingWeek(nextWeek)
        setBestSellingPreset('CUSTOM_WEEK')
        void loadBestSellingReport('CUSTOM_WEEK', nextWeek)
    }

    function handleOrderShiftPresetChange(preset: RangePreset) {
        setOrderShiftPreset(preset)
        void loadOrderShiftReport(preset, selectedOrderShiftWeek)
    }

    function handleOrderShiftYearChange(year: number) {
        const nextWeek = getDefaultWeek(year)

        setOrderShiftYear(year)
        setSelectedOrderShiftWeek(nextWeek)
        setOrderShiftPreset('CUSTOM_WEEK')
        void loadOrderShiftReport('CUSTOM_WEEK', nextWeek)
    }

    function handleOrderShiftWeekChange(weekValue: string) {
        const nextWeek = orderShiftWeekOptions.find(
            (week) => week.value === weekValue,
        )

        if (!nextWeek) {
            return
        }

        setSelectedOrderShiftWeek(nextWeek)
        setOrderShiftPreset('CUSTOM_WEEK')
        void loadOrderShiftReport('CUSTOM_WEEK', nextWeek)
    }

    async function handleApplyCustomRange() {
        const apiFromDate = parseManualDateForApi(fromDate)
        const apiToDate = parseManualDateForApi(toDate)

        if (!apiFromDate || !apiToDate) {
            setCustomRangeError(
                'Vui lòng nhập ngày theo định dạng ngày/tháng/năm.',
            )
            return
        }

        if (apiFromDate > apiToDate) {
            setCustomRangeError(
                'Từ ngày phải nhỏ hơn hoặc bằng đến ngày.',
            )
            return
        }

        try {
            setIsCustomLoading(true)
            setCustomRangeError(null)

            const {data} = await adminApi.getCustomRevenue(
                apiFromDate,
                apiToDate,
            )

            setRevenueData((currentData) => ({
                ...currentData,
                customRangeRevenue: data,
            }))
        } catch (error) {
            console.error(error)
            setCustomRangeError(
                getApiErrorMessage(
                    error,
                    'Không thể tải doanh thu theo khoảng thời gian đã chọn.',
                ),
            )
        } finally {
            setIsCustomLoading(false)
        }
    }

    return (
        <div className="rims-statistics-container">
            <StatisticsReportSelector
                activeReport={activeReport}
                bestSellerCount={bestSellers.length}
                highestShiftName={
                    orderShiftReport?.highestOrderShift?.displayName
                }
                totalRevenue={revenueData.totalRevenue?.revenue}
                onSelectReport={setActiveReport}
            />

            {activeReport === 'revenue' && (
                <RevenueDashboard
                    customRangeError={customRangeError}
                    data={revenueData}
                    error={revenueError}
                    fromDate={fromDate}
                    isCustomLoading={isCustomLoading}
                    isLoading={isRevenueLoading}
                    toDate={toDate}
                    onApplyCustomRange={() => void handleApplyCustomRange()}
                    onFromDateChange={setFromDate}
                    onReload={() => void loadRevenueDashboard()}
                    onToDateChange={setToDate}
                />
            )}

            {activeReport === 'categoryBestsellers' && (
                <BestSellersReport
                    categories={categories}
                    error={categoryBestSellingError}
                    isLoading={isCategoryBestSellingLoading}
                    items={categoryBestSellers}
                    preset={categoryBestSellingPreset}
                    selectedCategoryId={selectedBestSellingCategoryId}
                    selectedWeek={selectedCategoryBestSellingWeek}
                    selectedYear={categoryBestSellingYear}
                    subtitle="Lọc top món bán chạy theo từng danh mục, theo hôm nay, 7 ngày gần nhất hoặc tuần của một năm cụ thể."
                    title="Top món bán chạy theo danh mục"
                    weekOptions={categoryBestSellingWeekOptions}
                    yearOptions={yearOptions}
                    onCategoryChange={handleBestSellingCategoryChange}
                    onPresetChange={handleCategoryBestSellingPresetChange}
                    onWeekChange={handleCategoryBestSellingWeekChange}
                    onYearChange={handleCategoryBestSellingYearChange}
                />
            )}

            {activeReport === 'bestsellers' && (
                <BestSellersReport
                    error={bestSellingError}
                    isLoading={isBestSellingLoading}
                    items={bestSellers}
                    preset={bestSellingPreset}
                    selectedWeek={selectedBestSellingWeek}
                    selectedYear={bestSellingYear}
                    weekOptions={bestSellingWeekOptions}
                    yearOptions={yearOptions}
                    onPresetChange={handleBestSellingPresetChange}
                    onWeekChange={handleBestSellingWeekChange}
                    onYearChange={handleBestSellingYearChange}
                />
            )}

            {activeReport === 'orderShifts' && (
                <OrderShiftDashboard
                    error={orderShiftError}
                    isLoading={isOrderShiftLoading}
                    preset={orderShiftPreset}
                    report={orderShiftReport}
                    selectedWeek={selectedOrderShiftWeek}
                    selectedYear={orderShiftYear}
                    weekOptions={orderShiftWeekOptions}
                    yearOptions={yearOptions}
                    onPresetChange={handleOrderShiftPresetChange}
                    onWeekChange={handleOrderShiftWeekChange}
                    onYearChange={handleOrderShiftYearChange}
                />
            )}
        </div>
    )
}
