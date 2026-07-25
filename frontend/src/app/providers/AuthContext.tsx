import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'

import * as authApi from '@/shared/api/auth'
import type {
    AuthUser,
    LoginRequest,
} from '@/shared/types/auth'
import {hasAccessToken} from '@/shared/utils/tokenStorage'
import {getErrorMessage} from '@/shared/utils/error'

interface AuthContextValue {
    user: AuthUser | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
    login: (request: LoginRequest) => Promise<void>
    logout: () => Promise<void>
    clearError: () => void
}

const AuthContext =
    createContext<AuthContextValue | null>(null)

function isRequestCanceled(error: unknown) {
    if (typeof error !== 'object' || error === null) {
        return false
    }

    const requestError = error as {
        name?: string
        code?: string
        message?: string
    }

    return (
        requestError.name === 'CanceledError'
        || requestError.code === 'ERR_CANCELED'
        || requestError.message === 'canceled'
    )
}

export function AuthProvider({
                                 children,
                             }: {
    children: ReactNode
}) {
    const [user, setUser] =
        useState<AuthUser | null>(null)

    const [isLoading, setIsLoading] =
        useState(true)

    const [error, setError] =
        useState<string | null>(null)

    useEffect(() => {
        const controller =
            new AbortController()

        async function restoreSession() {
            if (!hasAccessToken()) {
                setIsLoading(false)
                return
            }

            try {
                const currentUser =
                    await authApi.getCurrentUser(
                        controller.signal,
                    )

                if (controller.signal.aborted) {
                    return
                }

                setUser(currentUser)
            } catch (requestError: unknown) {
                if (
                    controller.signal.aborted
                    || isRequestCanceled(requestError)
                ) {
                    return
                }

                console.error(
                    '[AUTH_RESTORE_SESSION_ERROR]',
                    requestError,
                )

                await authApi.logout()
                setUser(null)
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        void restoreSession()

        return () => {
            controller.abort()
        }
    }, [])

    const login =
        useCallback(
            async (request: LoginRequest) => {
                setError(null)
                setIsLoading(true)

                try {
                    const loggedInUser =
                        await authApi.login(request)

                    setUser(loggedInUser)
                } catch (requestError: unknown) {
                    if (isRequestCanceled(requestError)) {
                        return
                    }

                    console.error(
                        '[AUTH_LOGIN_ERROR]',
                        requestError,
                    )

                    setError(
                        getErrorMessage(requestError),
                    )

                    throw requestError
                } finally {
                    setIsLoading(false)
                }
            },
            [],
        )

    const logout =
        useCallback(
            async () => {
                setIsLoading(true)

                try {
                    await authApi.logout()
                } finally {
                    setUser(null)
                    setError(null)
                    setIsLoading(false)
                }
            },
            [],
        )

    const clearError =
        useCallback(
            () => setError(null),
            [],
        )

    const value =
        useMemo<AuthContextValue>(
            () => ({
                user,
                isAuthenticated: user !== null,
                isLoading,
                error,
                login,
                logout,
                clearError,
            }),
            [
                user,
                isLoading,
                error,
                login,
                logout,
                clearError,
            ],
        )

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

/* eslint-disable react-refresh/only-export-components */
export function useAuth(): AuthContextValue {
    const context =
        useContext(AuthContext)

    if (!context) {
        throw new Error(
            'useAuth phải được sử dụng bên trong AuthProvider',
        )
    }

    return context
}
