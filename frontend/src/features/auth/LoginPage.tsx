import {
    useState,
    type CSSProperties,
    type FormEvent,
} from 'react'
import {
    Link,
    useNavigate,
} from 'react-router-dom'

import {login} from '@/shared/api/auth'
import {useActor} from '@/app/providers/ActorContext'
import {RoleType} from '@/shared/types/auth'
import {getErrorMessage} from '@/shared/utils/error'

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

function getRedirectPath(role: RoleType) {
    switch (role) {
        case RoleType.ADMIN:
            return '/admin/dashboard'

        case RoleType.CHEF:
            return '/chef/dashboard'

        case RoleType.WAITER:
            return '/waiter/tables'

        case RoleType.CASHIER:
            return '/cashier/payments'

        case RoleType.CUSTOMER:
            return '/profile'

        default:
            return '/dashboard'
    }
}

export default function LoginPage() {
    const navigate = useNavigate()
    const {setActor} = useActor()

    const [username, setUsername] =
        useState('')

    const [rawPassword, setRawPassword] =
        useState('')

    const [error, setError] =
        useState<string | null>(null)

    const [isLoading, setIsLoading] =
        useState(false)

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault()

        setIsLoading(true)
        setError(null)

        try {
            const user =
                await login({
                    username,
                    rawPassword,
                })

            const role =
                user.role as RoleType

            setActor(role)

            localStorage.setItem(
                'selectedActor',
                role,
            )

            localStorage.setItem(
                'currentUser',
                JSON.stringify(user),
            )

            navigate(
                getRedirectPath(role),
                {
                    replace: true,
                },
            )
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[LOGIN_ERROR]',
                requestError,
            )

            setError(
                getErrorMessage(requestError)
                || 'Đăng nhập thất bại. Vui lòng kiểm tra tài khoản hoặc mật khẩu.',
            )
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="login-page">
            <section className="login-card">
                <Link
                    className="login-back-link"
                    to="/"
                >
                    ← Quay lại trang chủ
                </Link>

                <div className="login-header">
                    <h1>Đăng nhập Mãn Vị Lâu</h1>

                    <p>
                        Đăng nhập tài khoản để đặt bàn ngay hôm nay!
                    </p>
                </div>

                {error && (
                    <div className="auth-error">
                        {error}
                    </div>
                )}

                <form onSubmit={(event) => void handleSubmit(event)}>
                    <label className="auth-field">
                        Username

                        <input
                            value={username}
                            placeholder="Nhập tên đăng nhập"
                            required
                            autoComplete="username"
                            onChange={(event) =>
                                setUsername(event.target.value)
                            }
                        />
                    </label>

                    <label className="auth-field">
                        Password

                        <input
                            type="password"
                            value={rawPassword}
                            placeholder="Nhập mật khẩu"
                            required
                            autoComplete="current-password"
                            onChange={(event) =>
                                setRawPassword(event.target.value)
                            }
                        />
                    </label>

                    <div style={forgotPasswordRowStyle}>
                        <Link
                            to="/forgot-password"
                            style={forgotPasswordLinkStyle}
                        >
                            Quên mật khẩu?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        className="auth-submit"
                        disabled={isLoading}
                    >
                        {isLoading
                            ? 'Đang đăng nhập...'
                            : 'Đăng nhập'}
                    </button>
                </form>

                <div style={registerTextStyle}>
                    Chưa có tài khoản?{' '}

                    <Link
                        to="/register"
                        style={registerLinkStyle}
                    >
                        Đăng ký ngay
                    </Link>
                </div>
            </section>
        </main>
    )
}

const forgotPasswordRowStyle: CSSProperties = {
    textAlign: 'right',
    marginBottom: '8px',
}

const forgotPasswordLinkStyle: CSSProperties = {
    fontSize: '13px',
    color: '#7a1030',
    textDecoration: 'none',
}

const registerTextStyle: CSSProperties = {
    textAlign: 'center',
    marginTop: '16px',
    fontSize: '13px',
    color: '#9ca3af',
}

const registerLinkStyle: CSSProperties = {
    color: '#7a1030',
    textDecoration: 'none',
    fontWeight: 600,
}