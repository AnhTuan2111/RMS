import {PresetButtonGroup} from './RevenueDashboard'
import {
    formatNumber,
    formatRevenueCurrency,
    getDishInitial,
    resolveDishImageSrc,
} from './format'
import {CrownIcon} from './icons'
import type {RangePreset, WeekOption} from './types'
import type {BestSellingDishItem, CategoryResponse} from '@/shared/api/admin'
import {useState} from 'react'
export function BestSellerDishImage({
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

export function BestSellersReport({
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
    const maxQuantity = Math.max(...items.map((item) => item.totalQuantity), 1)

    return (
        <section className="order-shift-dashboard-panel admin-bestseller-dashboard-panel">
            <header className="order-shift-dashboard-header">
                <div>
                    <h2>{title}</h2>
                    <p className="rims-report-subtitle">{subtitle}</p>
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
                            onChange={(event) => onCategoryChange(event.target.value)}
                        >
                            {categories.length === 0 ? (
                                <option value="ALL">Chưa có danh mục</option>
                            ) : (
                                categories.map((category) => (
                                    <option key={category.id} value={String(category.id)}>
                                        {category.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </label>
                </div>
            )}

            {error && <p className="revenue-comparison-error">{error}</p>}

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
                                    {rank === 1 && <CrownIcon />}
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
                                            {formatRevenueCurrency(item.totalRevenue)}
                                        </span>
                                    </div>

                                    <div className="item-visual-bar-container">
                                        <div
                                            className="item-bar-fill"
                                            style={{
                                                width: `${Math.max(
                                                    8,
                                                    (item.totalQuantity / maxQuantity) *
                                                        100,
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
