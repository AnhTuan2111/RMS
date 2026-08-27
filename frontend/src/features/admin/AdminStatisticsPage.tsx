import {BestSellersReport} from '@/features/admin/statistics/BestSellersReport'
import {OrderShiftDashboard} from '@/features/admin/statistics/OrderShiftDashboard'
import {RevenueDashboard} from '@/features/admin/statistics/RevenueDashboard'
import {StatisticsReportSelector} from '@/features/admin/statistics/StatisticsReportSelector'
import {
    buildWeekOptions,
    getDefaultWeek,
    getRangeFromPreset,
    getYearOptions,
    parseManualDateForApi,
} from '@/features/admin/statistics/dateUtils'
import {emptyRevenueDashboardData} from '@/features/admin/statistics/types'
import type {
    RangePreset,
    ReportKey,
    RevenueDashboardData,
    WeekOption,
} from '@/features/admin/statistics/types'
import {useEffect, useState} from 'react'
import {useAdminSocket} from '@/realtime/useAdminSocket'
import * as adminApi from '@/shared/api/admin'
import type {
    BestSellingDishItem,
    CategoryResponse,
    OrderShiftReportResponse,
} from '@/shared/api/admin'
import {getErrorMessage} from '@/shared/utils/error'

export default function AdminStatisticsPage() {
    const [activeReport, setActiveReport] = useState<ReportKey>('revenue')
    const [revenueData, setRevenueData] = useState<RevenueDashboardData>(
        emptyRevenueDashboardData,
    )
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [revenueError, setRevenueError] = useState<string | null>(null)
    const [customRangeError, setCustomRangeError] = useState<string | null>(null)
    const [isRevenueLoading, setIsRevenueLoading] = useState(true)
    const [isCustomLoading, setIsCustomLoading] = useState(false)

    const [categories, setCategories] = useState<CategoryResponse[]>([])
    const [categoryBestSellingPreset, setCategoryBestSellingPreset] =
        useState<RangePreset>('LAST_7')
    const [categoryBestSellingYear, setCategoryBestSellingYear] = useState(() =>
        new Date().getFullYear(),
    )
    const [selectedCategoryBestSellingWeek, setSelectedCategoryBestSellingWeek] =
        useState<WeekOption>(() => getDefaultWeek(new Date().getFullYear()))
    const [selectedBestSellingCategoryId, setSelectedBestSellingCategoryId] =
        useState('ALL')
    const [categoryBestSellers, setCategoryBestSellers] = useState<BestSellingDishItem[]>(
        [],
    )
    const [categoryBestSellingError, setCategoryBestSellingError] = useState<
        string | null
    >(null)
    const [isCategoryBestSellingLoading, setIsCategoryBestSellingLoading] =
        useState(false)

    const [bestSellingPreset, setBestSellingPreset] = useState<RangePreset>('LAST_7')
    const [bestSellingYear, setBestSellingYear] = useState(() => new Date().getFullYear())
    const [selectedBestSellingWeek, setSelectedBestSellingWeek] = useState<WeekOption>(
        () => getDefaultWeek(new Date().getFullYear()),
    )
    const [bestSellers, setBestSellers] = useState<BestSellingDishItem[]>([])
    const [bestSellingError, setBestSellingError] = useState<string | null>(null)
    const [isBestSellingLoading, setIsBestSellingLoading] = useState(false)

    const [orderShiftPreset, setOrderShiftPreset] = useState<RangePreset>('LAST_7')
    const [orderShiftYear, setOrderShiftYear] = useState(() => new Date().getFullYear())
    const [selectedOrderShiftWeek, setSelectedOrderShiftWeek] = useState<WeekOption>(() =>
        getDefaultWeek(new Date().getFullYear()),
    )
    const [orderShiftReport, setOrderShiftReport] =
        useState<OrderShiftReportResponse | null>(null)
    const [orderShiftError, setOrderShiftError] = useState<string | null>(null)
    const [isOrderShiftLoading, setIsOrderShiftLoading] = useState(false)
    const yearOptions = getYearOptions()
    const categoryBestSellingWeekOptions = buildWeekOptions(categoryBestSellingYear)
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

    async function loadRevenueDashboard(showFullLoading = true, signal?: AbortSignal) {
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
            setRevenueError(getErrorMessage(error, 'Không thể tải báo cáo doanh thu.'))
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
            const {data} = await adminApi.getAllCategories(signal)
            const nextCategories = data ?? []
            const defaultCategoryId =
                nextCategories[0]?.id != null ? String(nextCategories[0].id) : 'ALL'

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
                getErrorMessage(error, 'Không thể tải danh mục món ăn.'),
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
            categoryIdValue === 'ALL' ? null : Number(categoryIdValue)
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
                getErrorMessage(error, 'Không thể tải top món bán chạy theo danh mục.'),
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
                getErrorMessage(error, 'Không thể tải dữ liệu món bán chạy.'),
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
                getErrorMessage(
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
        const nextWeek = bestSellingWeekOptions.find((week) => week.value === weekValue)

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
        const nextWeek = orderShiftWeekOptions.find((week) => week.value === weekValue)

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
            setCustomRangeError('Vui lòng nhập ngày theo định dạng ngày/tháng/năm.')
            return
        }

        if (apiFromDate > apiToDate) {
            setCustomRangeError('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.')
            return
        }

        try {
            setIsCustomLoading(true)
            setCustomRangeError(null)

            const {data} = await adminApi.getCustomRevenue(apiFromDate, apiToDate)

            setRevenueData((currentData) => ({
                ...currentData,
                customRangeRevenue: data,
            }))
        } catch (error) {
            console.error(error)
            setCustomRangeError(
                getErrorMessage(
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
                highestShiftName={orderShiftReport?.highestOrderShift?.displayName}
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
