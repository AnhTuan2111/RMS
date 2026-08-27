import {apiClient} from './client'
import type {
    TableDashboardResponse,
    OrderDetailResponse,
    PaymentRequest,
    PaymentResponse,
    VNPayResponse,
    PagedInvoiceResponse,
    InvoiceDetail,
} from '@/shared/types/cashier'

export type GetTodayInvoicesParams = {
    page: number
    size: number
    tableNumber?: string
    keyword?: string
    paymentMethod?: string
    invoiceCode?: string
}

// API 1: Lấy danh sách bàn
export const getTables = (signal?: AbortSignal) =>
    apiClient.get<TableDashboardResponse[]>('/cashier/tables', {
        signal,
    })

// API 2: Lấy chi tiết đơn hàng

export const getOrderDetail = (orderId: number, signal?: AbortSignal) =>
    apiClient.get<OrderDetailResponse>(`/cashier/orders/${orderId}`, {
        signal,
    })

// API 3: LOCKED trước khi thanh toán

export const processPaymentLock = (orderId: number, request: PaymentRequest) =>
    apiClient.post<PaymentResponse>(`/cashier/orders/${orderId}/payment`, request)

// API 4: Hoàn tất thanh toán tiền mặt

export const completeCashPayment = (orderId: number, request: PaymentRequest) =>
    apiClient.post<PaymentResponse>(`/cashier/orders/${orderId}/complete-cash`, request)

// API 5: Lấy mã QR VNPay

export const getVNPayQrCode = (
    orderId: number,
    customerId?: number | null,
    pointsUsed?: number,
    signal?: AbortSignal,
) =>
    apiClient.get<VNPayResponse>(`/cashier/orders/${orderId}/vnpay-qr`, {
        params: {
            customerId: customerId ?? undefined,
            pointsUsed,
        },
        signal,
    })

// API 6: Download invoice PDF

export const downloadInvoicePdf = (invoiceId: number, signal?: AbortSignal) =>
    apiClient.get(`/cashier/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
        signal,
    })

export const searchCustomer = (phone: string, signal?: AbortSignal) =>
    apiClient.get('/cashier/customers/search', {
        params: {
            phone,
        },
        signal,
    })

export const createCustomerFast = (data: {
    fullName: string
    phone: string
    email: string
}) => apiClient.post('/cashier/customers/create', data)

export const getTodayInvoices = (params: GetTodayInvoicesParams, signal?: AbortSignal) =>
    apiClient.get<PagedInvoiceResponse>('/cashier/invoices/today', {
        params,
        signal,
    })

export const getInvoiceDetail = (invoiceId: number, signal?: AbortSignal) =>
    apiClient.get<InvoiceDetail>(`/cashier/invoices/${invoiceId}`, {
        signal,
    })

export const unlockOrder = (orderId: number) =>
    apiClient.post<PaymentResponse>(`/cashier/orders/${orderId}/unlock`)

// API 7: Lấy danh sách phương thức thanh toán

export const getPaymentMethods = (signal?: AbortSignal) =>
    apiClient.get<string[]>('/cashier/payment-methods', {
        signal,
    })
