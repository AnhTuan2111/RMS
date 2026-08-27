import {
    formatDateForApi,
    formatDisplayDate,
    formatManualDateInput,
    getCalendarDays,
    getCalendarMonthDate,
    getCalendarYearOptions,
    isSameCalendarDate,
    parseVietnameseDate,
    vietnameseMonthLabels,
    vietnameseWeekdayLabels,
} from './dateUtils'
import {formatRevenueCurrency} from './format'
import {CalendarIcon, DongIcon} from './icons'
import type {RangePreset, RevenueDashboardData, WeekOption} from './types'
import {useEffect, useRef, useState, type KeyboardEvent} from 'react'
export function RevenueCard({
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
                <DongIcon />
            </div>

            <strong>{formatRevenueCurrency(amount)}</strong>
        </article>
    )
}

export function RevenueDateInput({
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
    const calendarYearOptions = getCalendarYearOptions(calendarDate.getFullYear())

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

        return () => document.removeEventListener('mousedown', handlePointerDown)
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
        setCalendarDate((currentDate) => new Date(currentDate.getFullYear(), month, 1))
    }

    function handleYearChange(year: number) {
        setCalendarDate((currentDate) => new Date(year, currentDate.getMonth(), 1))
    }

    function handleCalendarKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            setIsCalendarOpen(false)
        }
    }

    return (
        <div className="admin-revenue-date-field" ref={fieldRef}>
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
                    <CalendarIcon />
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
                                    handleMonthChange(Number(event.target.value))
                                }
                            >
                                {vietnameseMonthLabels.map((monthLabel, monthIndex) => (
                                    <option key={monthLabel} value={monthIndex}>
                                        {monthLabel}
                                    </option>
                                ))}
                            </select>

                            <span>năm</span>

                            <select
                                aria-label="Chọn năm"
                                value={calendarDate.getFullYear()}
                                onChange={(event) =>
                                    handleYearChange(Number(event.target.value))
                                }
                            >
                                {calendarYearOptions.map((year) => (
                                    <option key={year} value={year}>
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

                    <div aria-hidden="true" className="admin-revenue-calendar-weekdays">
                        {vietnameseWeekdayLabels.map((weekdayLabel) => (
                            <span key={weekdayLabel}>{weekdayLabel}</span>
                        ))}
                    </div>

                    <div className="admin-revenue-calendar-grid">
                        {calendarDays.map((date) => {
                            const dateValue = formatDateForApi(date)
                            const displayDate = formatDisplayDate(dateValue)
                            const isCurrentMonth =
                                date.getFullYear() === calendarDate.getFullYear() &&
                                date.getMonth() === calendarDate.getMonth()
                            const isSelected =
                                selectedDate && isSameCalendarDate(date, selectedDate)
                            const isToday = isSameCalendarDate(date, new Date())
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

export function PresetButtonGroup({
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
                        activePreset === 'TODAY' ? 'rims-btn-tab active' : 'rims-btn-tab'
                    }
                    disabled={isLoading}
                    type="button"
                    onClick={() => onChange('TODAY')}
                >
                    Hôm nay
                </button>
                <button
                    className={
                        activePreset === 'LAST_7' ? 'rims-btn-tab active' : 'rims-btn-tab'
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
                            onChange={(event) => onYearChange(Number(event.target.value))}
                        >
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>
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
                            onChange={(event) => onWeekChange(event.target.value)}
                        >
                            {weekOptions.map((week) => (
                                <option key={week.value} value={week.value}>
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

export function RevenueDashboard({
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
                    <button disabled={isLoading} type="button" onClick={onReload}>
                        Thử lại
                    </button>
                </div>
            )}

            <div aria-busy={isLoading} className="admin-revenue-card-row">
                <RevenueCard amount={data.totalRevenue?.revenue} title="Tổng doanh thu" />
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
                <RevenueCard amount={data.yearlyRevenue?.revenue} title="Doanh thu năm" />
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
