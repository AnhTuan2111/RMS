import {apiClient} from './client'
import type {
    LoginRequest,
    LoginResponse,
    UserProfile,
} from '@/shared/types/auth'
import {
    clearTokens,
    setTokens,
    getRefreshToken
} from '../utils/tokenStorage'

export interface RegisterRequest {
    username: string
    fullName: string
    email: string
    phone: string
}

export interface RegisterResponse {
    id: number
    userId?: number
    username: string
    fullName: string
    email: string | null
    phone: string
    role: string
    isActive: boolean
    createdAt: string
    rewardPoints?: number
}

function saveCurrentUser(user: UserProfile) {
    localStorage.setItem(
        'currentUser',
        JSON.stringify(user),
    )
}

function readCachedCurrentUser() {
    const cached =
        localStorage.getItem('currentUser')

    if (!cached) {
        return null
    }

    try {
        return JSON.parse(cached) as UserProfile
    } catch {
        localStorage.removeItem('currentUser')
        return null
    }
}

function normalizeLoginUser(
    response: LoginResponse,
): UserProfile {
    return {
        userId:
            response.userId
            ?? response.id
            ?? 0,

        id:
            response.id
            ?? response.userId,

        username: response.username,
        fullName: response.fullName,
        phone: response.phone,
        email: response.email,
        role: response.role,
        rewardPoints: response.rewardPoints,
    }
}

function normalizeProfileUser(
    response: UserProfile,
): UserProfile {
    return {
        userId:
            response.userId
            ?? response.id
            ?? 0,

        id:
            response.id
            ?? response.userId,
        username: response.username,
        fullName: response.fullName,
        phone: response.phone,
        email: response.email,
        role: response.role as UserProfile['role'],
        rewardPoints: response.rewardPoints,
    }
}

export async function login(
    request: LoginRequest,
): Promise<LoginResponse> {
    const response =
        await apiClient.post<LoginResponse>(
            '/auth/login',
            request,
        )

    setTokens(
        response.data.accessToken,
        response.data.refreshToken,
    )

    saveCurrentUser(
        normalizeLoginUser(response.data),
    )

    return response.data
}

export async function getCurrentUser(
    signal?: AbortSignal,
): Promise<UserProfile> {
    const cached =
        readCachedCurrentUser()

    if (cached) {
        return cached
    }

    const response =
        await apiClient.get<UserProfile>(
            '/auth/me',
            {
                signal,
            },
        )

    const currentUser =
        normalizeProfileUser(response.data)

    saveCurrentUser(currentUser)

    return currentUser
}

export async function logout(): Promise<void> {
    const refreshToken = getRefreshToken()

    try {
        await apiClient.post('/auth/logout', {
            refreshToken,
        })
    } catch (error) {
        console.error('[AUTH_LOGOUT_API_ERROR]', error)
    } finally {
        clearTokens()
        localStorage.removeItem('currentUser')
        localStorage.removeItem('selectedActor')
    }
}

export async function forgotPassword(
    email: string,
    signal?: AbortSignal,
): Promise<void> {
    await apiClient.post(
        '/auth/forgot-password',
        {
            email,
        },
        {
            signal,
        },
    )
}

export async function resetPassword(
    email: string,
    otp: string,
    newPassword: string,
    signal?: AbortSignal,
): Promise<void> {
    await apiClient.post(
        '/auth/reset-password',
        {
            email,
            otp,
            newPassword,
        },
        {
            signal,
        },
    )
}

export async function register(
    data: RegisterRequest,
    signal?: AbortSignal,
): Promise<RegisterResponse> {
    const response =
        await apiClient.post<RegisterResponse>(
            '/auth/register',
            data,
            {
                signal,
            },
        )

    return response.data
}