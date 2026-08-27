import {apiClient} from './client'

import type {KitchenOrderItemResponse, OrderItemStatus} from '@/shared/types/order'

export type {KitchenOrderItemResponse, OrderItemStatus}

export type DishDetailResponse = {
    orderItemId: number
    tableNumber: string
    dishName: string
    description?: string
    quantity: number
    note?: string
    status: OrderItemStatus
    createdAt?: string

    chefInternalNote?: string
    chefInternalNoteCreatedAt?: string
    chefInternalNoteAcknowledgedAt?: string
}

export type DishListResponse = {
    dishId: number
    dishName: string
    category: string
    price: number
    available: boolean
}

export type ChefDashboardResponse = {
    preparingCount: number
    completedCount: number
    cancelledCount: number
    unavailableDishCount: number
}

export type CancelledOrderResponse = {
    orderItemId: number
    orderId: number
    tableNumber: string
    dishName: string
    quantity: number
    cancelReason?: string
    cancelledAt?: string
}

export type GroupedKitchenItemResponse = {
    orderItemId: number
    orderId: number
    tableNumber: string
    quantity: number
    createdAt?: string
}

export type GroupedKitchenOrderResponse = {
    groupKey: string
    dishId: number
    dishName: string
    note?: string
    hasNote: boolean
    totalQuantity: number
    earliestCreatedAt?: string
    items: GroupedKitchenItemResponse[]
}

/**
 * Lấy danh sách món đang chuẩn bị.
 * GET /rims/chef/orders
 */
export async function getKitchenOrders(
    signal?: AbortSignal,
): Promise<KitchenOrderItemResponse[]> {
    const response = await apiClient.get<KitchenOrderItemResponse[]>('/chef/orders', {
        signal,
    })

    return response.data
}

/**
 * Xem chi tiết một món.
 * GET /rims/chef/orders/{orderItemId}
 */
export async function getDishDetail(orderItemId: number): Promise<DishDetailResponse> {
    const response = await apiClient.get<DishDetailResponse>(
        `/chef/orders/${orderItemId}`,
    )

    return response.data
}

/**
 * Cập nhật trạng thái món.
 * PUT /rims/chef/orders/{orderItemId}/status
 */
export async function updateOrderItemStatus(
    orderItemId: number,
    status: OrderItemStatus,
): Promise<string> {
    const response = await apiClient.put<string>(`/chef/orders/${orderItemId}/status`, {
        status,
    })

    return response.data
}

/**
 * Lấy danh sách món ăn.
 * GET /rims/chef/dishes
 */
export async function getChefDishes(signal?: AbortSignal): Promise<DishListResponse[]> {
    const response = await apiClient.get<DishListResponse[]>('/chef/dishes', {
        signal,
    })

    return response.data
}

/**
 * Bật hoặc tắt trạng thái bán của món.
 * PUT /rims/chef/dishes/{dishId}/status
 */
export async function updateMenuStatus(
    dishId: number,
    available: boolean,
): Promise<string> {
    const response = await apiClient.put<string>(`/chef/dishes/${dishId}/status`, {
        available,
    })

    return response.data
}

/**
 * Lấy số liệu Chef Dashboard.
 * GET /rims/chef/dashboard
 */
export async function getChefDashboard(
    signal?: AbortSignal,
): Promise<ChefDashboardResponse> {
    const response = await apiClient.get<ChefDashboardResponse>('/chef/dashboard', {
        signal,
    })

    return response.data
}

/**
 * Hủy món.
 * PUT /rims/chef/orders/{orderItemId}/cancel
 */
export async function cancelDish(orderItemId: number, reason: string): Promise<void> {
    await apiClient.put(`/chef/orders/${orderItemId}/cancel`, {
        reason,
    })
}

/**
 * Lấy danh sách món đã hoàn thành.
 * GET /rims/chef/orders/completed
 */
export async function getCompletedOrders(
    signal?: AbortSignal,
): Promise<KitchenOrderItemResponse[]> {
    const response = await apiClient.get<KitchenOrderItemResponse[]>(
        '/chef/orders/completed',
        {
            signal,
        },
    )

    return response.data
}

/**
 * Lấy danh sách món đã hủy.
 * GET /rims/chef/orders/cancelled
 */
export async function getCancelledOrders(
    signal?: AbortSignal,
): Promise<CancelledOrderResponse[]> {
    const response = await apiClient.get<CancelledOrderResponse[]>(
        '/chef/orders/cancelled',
        {
            signal,
        },
    )

    return response.data
}

/**
 * Lấy danh sách món đã gom.
 * GET /rims/chef/orders/grouped
 */
export async function getGroupedKitchenOrders(
    signal?: AbortSignal,
): Promise<GroupedKitchenOrderResponse[]> {
    const response = await apiClient.get<GroupedKitchenOrderResponse[]>(
        '/chef/orders/grouped',
        {
            signal,
        },
    )

    return response.data
}

/**
 * Hoàn thành các món trong một nhóm.
 * PUT /rims/chef/orders/grouped/complete
 */
export async function completeGroupedKitchenOrders(
    orderItemIds: number[],
): Promise<void> {
    await apiClient.put('/chef/orders/grouped/complete', {
        orderItemIds,
    })
}

/**
 * Chef gửi, cập nhật hoặc xóa ghi chú nội bộ.
 * PUT /rims/chef/orders/{orderItemId}/internal-note
 */
export async function updateChefInternalNote(
    orderItemId: number,
    note: string,
): Promise<DishDetailResponse> {
    const response = await apiClient.put<DishDetailResponse>(
        `/chef/orders/${orderItemId}/internal-note`,
        {
            note,
        },
    )

    return response.data
}
