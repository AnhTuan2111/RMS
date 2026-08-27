import {shiftCatalog} from './types'
import type {ShiftViewItem} from './types'
import type {OrderShiftReportResponse} from '@/shared/api/admin'
export function formatRevenueCurrency(value?: number | null) {
    return `${new Intl.NumberFormat('vi-VN').format(value ?? 0)} ₫`
}

export function formatNumber(value?: number | null) {
    return new Intl.NumberFormat('vi-VN').format(value ?? 0)
}

export function getDishInitial(dishName: string) {
    return dishName.trim().charAt(0).toUpperCase() || '?'
}

export function resolveDishImageSrc(imageUrl?: string | null) {
    const value = imageUrl?.trim()

    if (!value) {
        return null
    }

    if (
        value.startsWith('http') ||
        value.startsWith('//') ||
        value.startsWith('data:') ||
        value.startsWith('/')
    ) {
        return value
    }

    return `/image/${value}`
}

export function formatDecimal(value?: number | null) {
    return new Intl.NumberFormat('vi-VN', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    }).format(value ?? 0)
}

export function buildShiftRows(report: OrderShiftReportResponse | null): ShiftViewItem[] {
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
            orderCount: apiShift?.orderCount ?? fallbackShift?.orderCount ?? 0,
            percentage: apiShift?.percentage ?? fallbackShift?.percentage ?? 0,
        }
    })
}

export function buildDonutGradient(rows: ShiftViewItem[]) {
    const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0)

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
