/**
 * shared/types/order.ts
 * Canonical order DTOs shared by waiter, chef, and cashier features.
 * Previously duplicated across shared/api/waiter.ts, shared/api/chef.ts,
 * and shared/types/cashier.ts.
 */

/** Status of a single order item in the kitchen */
export type OrderItemStatus = 'PREPARING' | 'COMPLETED' | 'CANCELLED'

/** A line item within an order (waiter/cashier view) */
export interface OrderItemResponse {
    orderItemId?: number
    dishName: string
    status?: OrderItemStatus
    quantity: number
    unitPrice: number
    subTotal: number
    note?: string | null
    cancelReason?: string | null
    chefInternalNote?: string | null
    chefInternalNoteCreatedAt?: string | null
    chefInternalNoteAcknowledgedAt?: string | null
}

/** Full order detail (waiter + cashier view) */
export interface OrderDetailResponse {
    orderId: number
    tableNumber: string
    tableName?: string // alias used by cashier
    createdAt: string
    orderItems: OrderItemResponse[]
    totalAmountBeforeVat: number
    vatAmount: number
    finalAmount: number
}

/** Kitchen view of a single order item */
export interface KitchenOrderItemResponse {
    orderItemId: number
    orderId: number
    tableNumber: string
    dishName: string
    quantity: number
    status: OrderItemStatus
    createdAt?: string
}
