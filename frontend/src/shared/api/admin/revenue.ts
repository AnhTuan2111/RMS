/**
 * shared/api/admin/revenue.ts
 * Revenue reporting, best-selling dishes, and order-shift analytics endpoints.
 * Split from the original 637-line admin/index.ts god file.
 */

import {apiClient} from '../client'
import type {
    BestSellingDishItem,
    BestSellingReportResponse,
    DailyRevenueItem,
    HighestOrderShift,
    OrderShiftItem,
    OrderShiftReportResponse,
    RevenueReportResponse,
    WeeklyRevenueChartResponse,
} from '@/shared/types/admin'

// Re-export types so callers can import from this file alone
export type {
    BestSellingDishItem,
    BestSellingReportResponse,
    DailyRevenueItem,
    HighestOrderShift,
    OrderShiftItem,
    OrderShiftReportResponse,
    RevenueReportResponse,
    WeeklyRevenueChartResponse,
}

/** Total all-time revenue */
export const getTotalRevenue = (signal?: AbortSignal) =>
    apiClient.get<RevenueReportResponse>('/admin/revenue/total', {signal})

/** Revenue for today */

export const getTodayRevenue = (signal?: AbortSignal) =>
    apiClient.get<RevenueReportResponse>('/admin/revenue/today', {signal})

/** Revenue for current week */

export const getWeeklyRevenue = (signal?: AbortSignal) =>
    apiClient.get<RevenueReportResponse>('/admin/revenue/weekly', {signal})

/** Revenue for current month */

export const getMonthlyRevenue = (signal?: AbortSignal) =>
    apiClient.get<RevenueReportResponse>('/admin/revenue/monthly', {signal})

/** Revenue for current year */

export const getYearlyRevenue = (signal?: AbortSignal) =>
    apiClient.get<RevenueReportResponse>('/admin/revenue/yearly', {signal})

/** Daily revenue chart data for a date range */

export const getDailyRevenue = (fromDate: string, toDate: string, signal?: AbortSignal) =>
    apiClient.get<WeeklyRevenueChartResponse>('/admin/revenue/daily', {
        params: {fromDate, toDate},
        signal,
    })

/** Revenue for a custom date range */

export const getCustomRevenue = (
    fromDate: string,
    toDate: string,
    signal?: AbortSignal,
) =>
    apiClient.get<RevenueReportResponse>('/admin/revenue/custom', {
        params: {fromDate, toDate},
        signal,
    })

/** Best-selling dishes for a custom date range */

export const getBestSellingReportBetween = (
    fromDate: string,
    toDate: string,
    categoryId?: number | null,
    signal?: AbortSignal,
) =>
    apiClient.get<BestSellingReportResponse>('/admin/revenue/best-selling', {
        params: {fromDate, toDate, ...(categoryId ? {categoryId} : {})},
        signal,
    })

/** Order-shift analytics for a custom date range */

export const getOrderShiftReportBetween = (
    fromDate: string,
    toDate: string,
    signal?: AbortSignal,
) =>
    apiClient.get<OrderShiftReportResponse>('/admin/revenue/order-shifts', {
        params: {fromDate, toDate},
        signal,
    })
