import axios from 'axios'
import type {ApiErrorResponse} from '../types/api-error'

type ErrorLikeResponse = {
    message?: string
    error?: string
    details?: Record<string, string>
}

const DEFAULT_ERROR_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.'

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const candidate = value as Partial<ApiErrorResponse>

    return typeof candidate.status === 'number' && typeof candidate.message === 'string'
}

export function isRequestCanceled(error: unknown) {
    if (axios.isCancel(error)) {
        return true
    }

    if (typeof error !== 'object' || error === null) {
        return false
    }

    const requestError = error as {
        name?: string
        code?: string
        message?: string
    }

    return (
        requestError.name === 'CanceledError' ||
        requestError.code === 'ERR_CANCELED' ||
        requestError.message === 'canceled'
    )
}

function formatDetails(details?: Record<string, string>) {
    if (!details || Object.keys(details).length === 0) {
        return null
    }

    return Object.entries(details)
        .map(([field, message]) => `${field}: ${message}`)
        .join('\n')
}

function getMessageFromResponseData(data: unknown) {
    if (!data) {
        return null
    }

    if (typeof data === 'string') {
        return data
    }

    // Ưu tiên message: GlobalExceptionHandler ở backend đã đặt sẵn câu tiếng Việt
    // dành cho người dùng. details là map field -> lỗi, chỉ dùng khi không có
    // message, vì hiển thị thẳng ra sẽ lộ tên field kỹ thuật ("phone: ...").
    if (isApiErrorResponse(data)) {
        return data.message ?? data.error ?? formatDetails(data.details)
    }

    if (typeof data === 'object') {
        const responseData = data as ErrorLikeResponse

        return (
            responseData.message ??
            responseData.error ??
            formatDetails(responseData.details) ??
            null
        )
    }

    return null
}

export function getErrorMessage(
    error: unknown,
    fallback = DEFAULT_ERROR_MESSAGE,
): string {
    if (isRequestCanceled(error)) {
        return ''
    }

    if (axios.isAxiosError(error)) {
        const responseMessage = getMessageFromResponseData(error.response?.data)

        if (responseMessage) {
            return responseMessage
        }

        if (error.message) {
            return error.message
        }
    }

    if (error instanceof Error && error.message) {
        return error.message
    }

    if (typeof error === 'string' && error.trim()) {
        return error
    }

    return fallback
}
