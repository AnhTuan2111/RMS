import type {OrderShiftItem, RevenueReportResponse} from '@/shared/api/admin'
export type ReportKey = 'revenue' | 'categoryBestsellers' | 'bestsellers' | 'orderShifts'

export type RangePreset = 'TODAY' | 'LAST_7' | 'CUSTOM_WEEK'

export interface RevenueDashboardData {
    totalRevenue: RevenueReportResponse | null
    todayRevenue: RevenueReportResponse | null
    weeklyRevenue: RevenueReportResponse | null
    monthlyRevenue: RevenueReportResponse | null
    yearlyRevenue: RevenueReportResponse | null
    customRangeRevenue: RevenueReportResponse | null
}

export interface WeekOption {
    value: string
    label: string
    fromDate: string
    toDate: string
}

export interface ShiftViewItem extends OrderShiftItem {
    color: string
}

export const emptyRevenueDashboardData: RevenueDashboardData = {
    totalRevenue: null,
    todayRevenue: null,
    weeklyRevenue: null,
    monthlyRevenue: null,
    yearlyRevenue: null,
    customRangeRevenue: null,
}

export const shiftCatalog = [
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
