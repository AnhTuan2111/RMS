import {apiClient} from './client'

import type {
    OrderDetailResponse,
    OrderItemResponse,
    OrderItemStatus,
} from '@/shared/types/order'
import type {TableDetailResponse, TableStatus} from '@/shared/types/table'

// Re-export so consumers don't break immediately
export type {
    OrderDetailResponse,
    OrderItemResponse,
    OrderItemStatus,
    TableDetailResponse,
    TableStatus,
}

// Enums
export type ReservationStatus = 'QUEUED' | 'WAITING' | 'COMPLETED' | 'CANCELLED'

// Responses
export type MenuItemResponse = {
    dishId: number
    name: string
    description: string
    price: number
    imageUrl: string
    categoryName: string
    available: boolean
}

export type CreateOrderResponse = {
    orderId: number
    tableNumber: string
    message: string
    totalAmount: number
}

export type UpdateOrderResponse = {
    orderId: number
    tableNumber: string
    message: string
    totalAmount: number
}

// Requests
export type OrderItemRequest = {
    dishId: number
    quantity: number
    note?: string
}

export type CreateOrderRequest = {
    tableId: number
    items: OrderItemRequest[]
}

export type UpdateOrderItemRequest = {
    orderItemId?: number | null
    dishId: number
    quantity: number
    note?: string
}

export type UpdateOrderRequest = {
    items: UpdateOrderItemRequest[]
}

export type CreateReservationRequest = {
    customerName: string
    phone: string
    note?: string
    tableId: number
    reservationTime: string
}

export type TimeRangeResponse = {
    start: string
    end: string
}

export type ReservationResponse = {
    id?: number
    reservationId?: number
    customerName: string
    phone: string
    note?: string | null
    tableId: number
    tableNumber?: string
    reservationTime: string
    status?: ReservationStatus
}

// API calls
export const getTables = (signal?: AbortSignal) =>
    apiClient.get<TableDetailResponse[]>('/waiter/tables', {
        signal,
    })

export const getMenu = (signal?: AbortSignal) =>
    apiClient.get<MenuItemResponse[]>('/waiter/menu', {
        signal,
    })

export const createOrder = (data: CreateOrderRequest) =>
    apiClient.post<CreateOrderResponse>('/waiter/orders', data)

export const createOrderFromReservation = (
    reservationId: number,
    data: CreateOrderRequest,
) =>
    apiClient.post<CreateOrderResponse>(
        `/waiter/reservations/${reservationId}/orders`,
        data,
    )

export const updateOrder = (orderId: number, data: UpdateOrderRequest) =>
    apiClient.put<UpdateOrderResponse>(`/waiter/orders/${orderId}`, data)

export const getServingOrders = (tableId: number, signal?: AbortSignal) =>
    apiClient.get<OrderDetailResponse[]>(`/waiter/detail/${tableId}`, {
        signal,
    })

export const createReservation = (data: CreateReservationRequest) =>
    apiClient.post<string>('/waiter/reservations', data)

export const getReservationsByTableAndDate = (
    tableId: number,
    date: string,
    signal?: AbortSignal,
) =>
    apiClient.get<ReservationResponse[]>(`/waiter/reservation/${tableId}/${date}`, {
        signal,
    })

export const getCurrentReservationByTable = (tableId: number, signal?: AbortSignal) =>
    apiClient.get<ReservationResponse | null>(`/waiter/reservation/detail/${tableId}`, {
        signal,
    })

export const getReservationDetail = (reservationId: number, signal?: AbortSignal) =>
    apiClient.get<ReservationResponse>(`/waiter/reservations/${reservationId}`, {
        signal,
    })

export const updateReservation = (
    reservationId: number,
    data: CreateReservationRequest,
) => apiClient.put<string>(`/waiter/reservations/${reservationId}`, data)

export const cancelReservation = (reservationId: number) =>
    apiClient.put<string>(`/waiter/reservations/${reservationId}/cancel`)

export const acknowledgeChefInternalNote = (orderItemId: number) =>
    apiClient.put<void>(`/waiter/order-items/${orderItemId}/chef-note/acknowledge`)

export const getBlockedTimeSlots = (
    tableId: number,
    date: string,
    excludeReservationId?: number,
    signal?: AbortSignal,
) =>
    apiClient.get<TimeRangeResponse[]>(`/waiter/tables/${tableId}/blocked-slots`, {
        params: {
            date,
            excludeReservationId,
        },
        signal,
    })
