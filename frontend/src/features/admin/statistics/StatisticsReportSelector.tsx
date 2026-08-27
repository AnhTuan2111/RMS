import {formatNumber, formatRevenueCurrency} from './format'
import {StatIcon} from './icons'
import type {ReportKey} from './types'
export function StatisticsReportSelector({
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
