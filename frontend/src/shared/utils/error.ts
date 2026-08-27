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

    if (isApiErrorResponse(data)) {
        return formatDetails(data.details) ?? data.message ?? data.error
    }

    if (typeof data === 'object') {
        const responseData = data as ErrorLikeResponse

        return (
            formatDetails(responseData.details) ??
            responseData.message ??
            responseData.error ??
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
