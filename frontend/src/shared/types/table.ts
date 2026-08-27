/**
 * shared/types/table.ts
 * Canonical table DTOs shared by waiter and admin features.
 * Breaks admin → waiter import coupling (previously admin/index.ts imported
 * TableDetailResponse directly from shared/api/waiter.ts).
 */

/** Status of a restaurant table */
export type TableStatus = 'AVAILABLE' | 'SERVING' | 'RESERVED'

/** Full table detail response (waiter + admin view) */
export interface TableDetailResponse {
    tableId: number
    tableNumber: string
    capacity: number
    status: TableStatus
    upcomingReservationTime?: string
    upcomingCustomerName?: string
}

/** Lightweight table info used in cashier dashboard */
export interface TableDashboardResponse {
    tableId: number
    tableNumber: string
    status: TableStatus
    orderId?: number | null
}
