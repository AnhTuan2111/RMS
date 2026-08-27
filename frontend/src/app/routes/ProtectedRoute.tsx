import {Navigate, useLocation} from 'react-router-dom'
import {useAuth} from '@/app/providers/AuthContext'
import type {ReactNode} from 'react'

export function ProtectedRoute({children}: {children: ReactNode}) {
    const {isAuthenticated, isLoading} = useAuth()
    const location = useLocation()

    if (isLoading) {
        return (
            <main className="app-loading">
                <p>Đang tải...</p>
            </main>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{from: location.pathname}} />
    }

    return <>{children}</>
}
