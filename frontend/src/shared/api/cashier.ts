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

export const cashierApi = {
    // API 1: Lấy danh sách bàn
    getTables: (signal?: AbortSignal) =>
        apiClient.get<TableDashboardResponse[]>('/cashier/tables', {
            signal,
        }),

    // API 2: Lấy chi tiết đơn hàng
    getOrderDetail: (orderId: number, signal?: AbortSignal) =>
        apiClient.get<OrderDetailResponse>(`/cashier/orders/${orderId}`, {
            signal,
        }),

    // API 3: LOCKED trước khi thanh toán
    processPaymentLock: (orderId: number, request: PaymentRequest) =>
        apiClient.post<PaymentResponse>(`/cashier/orders/${orderId}/payment`, request),

    // API 4: Hoàn tất thanh toán tiền mặt
    completeCashPayment: (orderId: number, request: PaymentRequest) =>
        apiClient.post<PaymentResponse>(
            `/cashier/orders/${orderId}/complete-cash`,
            request,
        ),

    // API 5: Lấy mã QR VNPay
    getVNPayQrCode: (
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
        }),

    // API 6: Download invoice PDF
    downloadInvoicePdf: (invoiceId: number, signal?: AbortSignal) =>
        apiClient.get(`/cashier/invoices/${invoiceId}/pdf`, {
            responseType: 'blob',
            signal,
        }),

    searchCustomer: (phone: string, signal?: AbortSignal) =>
        apiClient.get('/cashier/customers/search', {
            params: {
                phone,
            },
            signal,
        }),

    createCustomerFast: (data: {fullName: string; phone: string; email: string}) =>
        apiClient.post('/cashier/customers/create', data),

    getTodayInvoices: (params: GetTodayInvoicesParams, signal?: AbortSignal) =>
        apiClient.get<PagedInvoiceResponse>('/cashier/invoices/today', {
            params,
            signal,
        }),

    getInvoiceDetail: (invoiceId: number, signal?: AbortSignal) =>
        apiClient.get<InvoiceDetail>(`/cashier/invoices/${invoiceId}`, {
            signal,
        }),

    unlockOrder: (orderId: number) =>
        apiClient.post<PaymentResponse>(`/cashier/orders/${orderId}/unlock`),

    // API 7: Lấy danh sách phương thức thanh toán
    getPaymentMethods: (signal?: AbortSignal) =>
        apiClient.get<string[]>('/cashier/payment-methods', {
            signal,
        }),
}
