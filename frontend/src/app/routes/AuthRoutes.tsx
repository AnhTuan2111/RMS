import {Route} from 'react-router-dom'

import LoginPage from '../../features/auth/LoginPage'
import ForgotPasswordPage from '../../features/auth/ForgotPasswordPage'
import RegisterPage from '../../features/auth/RegisterPage'

export function renderAuthRoutes() {
    return (
        <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/register" element={<RegisterPage />} />
        </>
    )
}
