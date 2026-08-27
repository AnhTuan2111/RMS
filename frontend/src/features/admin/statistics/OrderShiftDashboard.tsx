import {PresetButtonGroup} from './RevenueDashboard'
import {getOrderShiftRangeLabel} from './dateUtils'
import {buildDonutGradient, buildShiftRows, formatDecimal, formatNumber} from './format'
import {FileIcon, TrendingIcon, TrophyIcon} from './icons'
import type {RangePreset, WeekOption} from './types'
import type {OrderShiftReportResponse} from '@/shared/api/admin'
export function OrderShiftDashboard({
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

            {error && <p className="revenue-comparison-error">{error}</p>}

            <div className="order-shift-kpi-grid">
                <article className="order-shift-kpi-card">
                    <span className="order-shift-kpi-icon icon-green">
                        <FileIcon />
                    </span>
                    <div>
                        <span>Tổng đơn đã thanh toán</span>
                        <strong>{formatNumber(totalOrders)} đơn</strong>
                    </div>
                </article>

                <article className="order-shift-kpi-card featured">
                    <span className="order-shift-kpi-icon icon-orange">
                        <TrophyIcon />
                    </span>
                    <div>
                        <span>Ca có nhiều đơn nhất</span>
                        <strong>{highestShift?.displayName ?? 'Chưa có dữ liệu'}</strong>
                        <small>
                            {formatNumber(highestShift?.orderCount ?? 0)} đơn •{' '}
                            {formatDecimal(highestShift?.percentage ?? 0)}%
                        </small>
                    </div>
                </article>

                <article className="order-shift-kpi-card">
                    <span className="order-shift-kpi-icon icon-green">
                        <TrendingIcon />
                    </span>
                    <div>
                        <span>Trung bình mỗi ngày</span>
                        <strong>{formatDecimal(averageOrdersPerDay)} đơn</strong>
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
                                        row.shiftName === highestShift?.shiftName
                                            ? 'order-shift-table-row highlighted'
                                            : 'order-shift-table-row'
                                    }
                                    key={row.shiftName}
                                >
                                    <span>{row.displayName}</span>
                                    <span>
                                        {row.startTime} - {row.endTime}
                                    </span>
                                    <span>{formatNumber(row.orderCount)} đơn</span>
                                    <span>{formatDecimal(row.percentage)}%</span>
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
                                                {formatDecimal(row.percentage)}% •{' '}
                                                {formatNumber(row.orderCount)} đơn
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
