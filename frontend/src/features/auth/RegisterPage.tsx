import {
    useState,
    type CSSProperties,
    type FormEvent,
} from 'react'
import {
    Link,
    useNavigate,
} from 'react-router-dom'

import {
    register,
    type RegisterRequest,
} from '@/shared/api/auth'
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

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizePhone(value: string) {
    return value.replace(/\D/g, '').slice(0, 10)
}

const DEFAULT_FORM: RegisterRequest = {
    username: '',
    fullName: '',
    email: '',
    phone: '',
}

export default function RegisterPage() {
    const navigate = useNavigate()

    const [formData, setFormData] =
        useState<RegisterRequest>(DEFAULT_FORM)

    const [error, setError] =
        useState<string | null>(null)

    const [isLoading, setIsLoading] =
        useState(false)

    function updateField<K extends keyof RegisterRequest>(
        key: K,
        value: RegisterRequest[K],
    ) {
        setFormData((previous) => ({
            ...previous,
            [key]: value,
        }))

        setError(null)
    }

    function validateForm() {
        if (!formData.username.trim()) {
            return 'Vui lòng nhập username.'
        }

        if (!formData.fullName.trim()) {
            return 'Vui lòng nhập họ và tên.'
        }

        if (!formData.email.trim()) {
            return 'Vui lòng nhập email.'
        }

        if (!isValidEmail(formData.email.trim())) {
            return 'Email không hợp lệ.'
        }

        if (!formData.phone.trim()) {
            return 'Vui lòng nhập số điện thoại.'
        }

        if (formData.phone.length !== 10) {
            return 'Số điện thoại phải có 10 chữ số.'
        }

        return null
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault()

        const validationError =
            validateForm()

        if (validationError) {
            setError(validationError)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            await register({
                username: formData.username.trim(),
                fullName: formData.fullName.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
            })

            navigate(
                '/login',
                {
                    state: {
                        message:
                            'Đăng ký thành công! Mật khẩu mặc định của bạn là: 123456',
                    },
                },
            )
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[REGISTER_ERROR]',
                requestError,
            )

            setError(
                getErrorMessage(requestError),
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
                    to="/login"
                >
                    ← Quay lại đăng nhập
                </Link>

                <div className="login-header">
                    <h1>Đăng ký tài khoản</h1>
                    <p>Tạo tài khoản khách hàng mới</p>
                </div>

                {error && (
                    <div className="auth-error">
                        {error}
                    </div>
                )}

                <form onSubmit={(event) => void handleSubmit(event)}>
                    <label className="auth-field">
                        Username *

                        <input
                            value={formData.username}
                            placeholder="Tên đăng nhập"
                            required
                            autoComplete="username"
                            onChange={(event) =>
                                updateField(
                                    'username',
                                    event.target.value,
                                )
                            }
                        />
                    </label>

                    <label className="auth-field">
                        Họ và tên *

                        <input
                            value={formData.fullName}
                            placeholder="Nguyễn Văn A"
                            required
                            autoComplete="name"
                            onChange={(event) =>
                                updateField(
                                    'fullName',
                                    event.target.value,
                                )
                            }
                        />
                    </label>

                    <label className="auth-field">
                        Email *

                        <input
                            type="email"
                            value={formData.email}
                            placeholder="email@gmail.com"
                            required
                            autoComplete="email"
                            onChange={(event) =>
                                updateField(
                                    'email',
                                    event.target.value,
                                )
                            }
                        />
                    </label>

                    <label className="auth-field">
                        Số điện thoại *

                        <input
                            value={formData.phone}
                            placeholder="0123456789"
                            required
                            inputMode="numeric"
                            autoComplete="tel"
                            maxLength={10}
                            onChange={(event) =>
                                updateField(
                                    'phone',
                                    normalizePhone(
                                        event.target.value,
                                    ),
                                )
                            }
                        />
                    </label>

                    <div style={defaultPasswordNoticeStyle}>
                        ℹ️ Mật khẩu mặc định sẽ là:{' '}
                        <strong>123456</strong>

                        <br />

                        <small>
                            Vui lòng thay đổi mật khẩu sau khi đăng nhập
                            lần đầu.
                        </small>
                    </div>

                    <button
                        type="submit"
                        className="auth-submit"
                        disabled={isLoading}
                    >
                        {isLoading
                            ? 'Đang đăng ký...'
                            : 'Tạo tài khoản'}
                    </button>
                </form>

                <div style={loginTextStyle}>
                    Đã có tài khoản?{' '}

                    <Link
                        to="/login"
                        style={loginLinkStyle}
                    >
                        Đăng nhập
                    </Link>
                </div>
            </section>
        </main>
    )
}

const defaultPasswordNoticeStyle: CSSProperties = {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 20,
    fontSize: 14,
    color: '#166534',
}

const loginTextStyle: CSSProperties = {
    textAlign: 'center',
    marginTop: '16px',
    fontSize: '13px',
    color: '#9ca3af',
}

const loginLinkStyle: CSSProperties = {
    color: '#7a1030',
    textDecoration: 'none',
    fontWeight: 600,
}