import type {ReactNode} from 'react'
import {BrowserRouter} from 'react-router-dom'

import {ActorProvider} from '@/app/providers/ActorContext'
import {AuthProvider} from '@/app/providers/AuthContext'

export function AppProviders({children}: {children: ReactNode}) {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ActorProvider>
                    {children}
                </ActorProvider>
            </AuthProvider>
        </BrowserRouter>
    )
}