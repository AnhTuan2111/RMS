/**
 * shared/api/admin/invoices.ts
 * Payment history and invoice detail endpoints.
 * Split from the original 637-line admin/index.ts god file.
 */

import {apiClient} from '../client'
import type {
    AdminPaymentDetail,
    AdminPaymentDetailItem,
    AdminPaymentHistoryItem,
    AdminPaymentHistoryPage,
    AdminPaymentMethod,
} from '@/shared/types/admin'

// Re-export types so callers can import from this file alone
export type {
    AdminPaymentDetail,
    AdminPaymentDetailItem,
    AdminPaymentHistoryItem,
    AdminPaymentHistoryPage,
    AdminPaymentMethod,
}

export interface InvoiceHistoryFilters {
    tableNumber?: string
    paymentMethod?: string
    keyword?: string
    customerKeyword?: string
}

/** Returns paginated payment history, có filter tùy chọn */
export const getPaymentHistory = (
    page = 1,
    pageSize = 10,
    filters?: InvoiceHistoryFilters,
    signal?: AbortSignal,
) =>
    apiClient.get<AdminPaymentHistoryPage>('/admin/invoice/history', {
        params: {
            page,
            pageSize,
            tableNumber: filters?.tableNumber || undefined,
            paymentMethod: filters?.paymentMethod || undefined,
            keyword: filters?.keyword || undefined,
            customerKeyword: filters?.customerKeyword || undefined,
        },
        signal,
    })

/** Returns detail for a single invoice */

export const getPaymentDetail = (invoiceId: number, signal?: AbortSignal) =>
    apiClient.get<AdminPaymentDetail>(`/admin/invoice/${invoiceId}`, {
        signal,
    })
