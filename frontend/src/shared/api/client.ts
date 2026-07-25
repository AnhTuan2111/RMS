import axios, {
    type AxiosError,
    type InternalAxiosRequestConfig,
} from 'axios'

import type {LoginResponse} from '@/shared/types/auth'
import {
    clearTokens,
    getAccessToken,
    getRefreshToken,
    setTokens,
} from '../utils/tokenStorage'

type RetriableRequestConfig =
    InternalAxiosRequestConfig & {
    _retry?: boolean
}

const AUTH_REFRESH_PATH = '/auth/refresh'
const AUTH_LOGIN_PATH = '/auth/login'
const AUTH_LOGOUT_PATH = '/auth/logout'

export const apiClient = axios.create({
    baseURL: '/rims',
    headers: {
        'Content-Type': 'application/json',
    },
})

function isAuthEndpoint(url?: string) {
    if (!url) return false
    return (
        url.includes(AUTH_LOGIN_PATH)
        || url.includes(AUTH_REFRESH_PATH)
        || url.includes(AUTH_LOGOUT_PATH)
    )
}

function setAuthorizationHeader(
    config: InternalAxiosRequestConfig,
    accessToken: string,
) {
    config.headers.Authorization =
        `Bearer ${accessToken}`
}

apiClient.interceptors.request.use(
    (config) => {
        const accessToken =
            getAccessToken()

        if (accessToken) {
            setAuthorizationHeader(
                config,
                accessToken,
            )
        }

        return config
    },
)

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
    const storedRefreshToken =
        getRefreshToken()

    if (!storedRefreshToken) {
        throw new Error('Thiếu token làm mới phiên đăng nhập')
    }

    const {data} =
        await axios.post<LoginResponse>(
            '/rims/auth/refresh',
            {
                refreshToken: storedRefreshToken,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        )

    setTokens(
        data.accessToken,
        data.refreshToken,
    )

    return data.accessToken
}

function shouldRefreshToken(
    error: AxiosError,
    originalRequest?: RetriableRequestConfig,
) {
    return (
        error.response?.status === 401
        && Boolean(originalRequest)
        && !originalRequest?._retry
        && !isAuthEndpoint(originalRequest?.url)
    )
}

apiClient.interceptors.response.use(
    (response) => response,

    async (error: AxiosError) => {
        const originalRequest =
            error.config as RetriableRequestConfig | undefined

        if (
            !shouldRefreshToken(
                error,
                originalRequest,
            )
        ) {
            return Promise.reject(error)
        }

        if (!originalRequest) {
            return Promise.reject(error)
        }

        const refreshToken =
            getRefreshToken()

        if (!refreshToken) {
            clearTokens()
            return Promise.reject(error)
        }

        originalRequest._retry = true

        try {
            refreshPromise ??=
                refreshAccessToken()

            const newAccessToken =
                await refreshPromise

            setAuthorizationHeader(
                originalRequest,
                newAccessToken,
            )

            return apiClient(originalRequest)
        } catch (refreshError: unknown) {
            clearTokens()

            return Promise.reject(refreshError)
        } finally {
            refreshPromise = null
        }
    },
)
