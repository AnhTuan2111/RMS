import {
    useState,
    type CSSProperties,
    type KeyboardEvent,
} from 'react'
import {
    Link,
    useNavigate,
} from 'react-router-dom'

import {
    forgotPassword,
    resetPassword,
} from '@/shared/api/auth'
import {getErrorMessage} from '@/shared/utils/error'

type Step =
    | 'email'
    | 'otp'
    | 'done'

const STEPS: Step[] = [
    'email',
    'otp',
    'done',
]

const STEP_LABELS: Record<Step, string> = {
    email: 'Nhập email',
    otp: 'Xác nhận OTP',
    done: 'Hoàn thành',
}

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

export default function ForgotPasswordPage() {
    const navigate = useNavigate()

    const [step, setStep] =
        useState<Step>('email')

    const [email, setEmail] =
        useState('')

    const [otp, setOtp] =
        useState('')

    const [newPassword, setNewPassword] =
        useState('')

    const [confirmPassword, setConfirmPassword] =
        useState('')

    const [isLoading, setIsLoading] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)

    const currentStepIdx =
        STEPS.indexOf(step)

    async function handleSendOtp() {
        const normalizedEmail =
            email.trim()

        if (!normalizedEmail) {
            setError('Vui lòng nhập email')
            return
        }

        if (!isValidEmail(normalizedEmail)) {
            setError('Email không hợp lệ')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            await forgotPassword(normalizedEmail)

            setStep('otp')
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[FORGOT_PASSWORD_SEND_OTP_ERROR]',
                requestError,
            )

            setError(
                getErrorMessage(requestError),
            )
        } finally {
            setIsLoading(false)
        }
    }

    async function handleResetPassword() {
        if (!otp || otp.length !== 6) {
            setError('OTP phải có đúng 6 chữ số')
            return
        }

        if (!newPassword || newPassword.length < 6) {
            setError('Mật khẩu mới phải có ít nhất 6 ký tự')
            return
        }

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            await resetPassword(
                email.trim(),
                otp,
                newPassword,
            )

            setStep('done')
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[FORGOT_PASSWORD_RESET_ERROR]',
                requestError,
            )

            setError(
                getErrorMessage(requestError),
            )
        } finally {
            setIsLoading(false)
        }
    }

    function handleEmailKeyDown(
        event: KeyboardEvent<HTMLInputElement>,
    ) {
        if (event.key === 'Enter') {
            event.preventDefault()
            void handleSendOtp()
        }
    }

    function handleResetKeyDown(
        event: KeyboardEvent<HTMLInputElement>,
    ) {
        if (event.key === 'Enter') {
            event.preventDefault()
            void handleResetPassword()
        }
    }

    function goBackToEmailStep() {
        setStep('email')
        setOtp('')
        setNewPassword('')
        setConfirmPassword('')
        setError(null)
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
                    <h1>Quên mật khẩu</h1>
                    <p>Chỉ dành cho tài khoản khách hàng.</p>
                </div>

                <div style={stepWrapperStyle}>
                    {STEPS.map((stepItem, index) => (
                        <div
                            key={stepItem}
                            style={{
                                ...stepItemStyle,
                                flex:
                                    index < STEPS.length - 1
                                        ? 1
                                        : 'none',
                            }}
                        >
                            <div style={stepInnerStyle}>
                                <div
                                    style={{
                                        ...stepCircleStyle,
                                        background:
                                            index < currentStepIdx
                                                ? '#22c55e'
                                                : index === currentStepIdx
                                                    ? '#7a1030'
                                                    : '#e5e7eb',
                                        color:
                                            index <= currentStepIdx
                                                ? '#fff'
                                                : '#9ca3af',
                                    }}
                                >
                                    {index < currentStepIdx
                                        ? '✓'
                                        : index + 1}
                                </div>

                                <span
                                    style={{
                                        ...stepLabelStyle,
                                        color:
                                            index === currentStepIdx
                                                ? '#7a1030'
                                                : '#9ca3af',
                                        fontWeight:
                                            index === currentStepIdx
                                                ? 600
                                                : 400,
                                    }}
                                >
                                    {STEP_LABELS[stepItem]}
                                </span>
                            </div>

                            {index < STEPS.length - 1 && (
                                <div
                                    style={{
                                        ...stepLineStyle,
                                        background:
                                            index < currentStepIdx
                                                ? '#22c55e'
                                                : '#e5e7eb',
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {error && (
                    <div
                        className="auth-error"
                        style={errorBoxStyle}
                    >
                        <span>{error}</span>

                        <button
                            type="button"
                            style={errorCloseButtonStyle}
                            onClick={() => setError(null)}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {step === 'email' && (
                    <>
                        <label className="auth-field">
                            Email tài khoản khách hàng

                            <input
                                type="email"
                                value={email}
                                placeholder="email@gmail.com"
                                autoFocus
                                onChange={(event) => {
                                    setEmail(event.target.value)
                                    setError(null)
                                }}
                                onKeyDown={handleEmailKeyDown}
                            />
                        </label>

                        <p style={hintTextStyle}>
                            Nhập đúng email đã đăng ký. Chúng tôi sẽ
                            gửi mã OTP 6 số — có hiệu lực trong 5 phút.
                        </p>

                        <button
                            type="button"
                            className="auth-submit"
                            disabled={isLoading}
                            onClick={() =>
                                void handleSendOtp()
                            }
                        >
                            {isLoading
                                ? 'Đang gửi...'
                                : 'Gửi mã OTP →'}
                        </button>
                    </>
                )}

                {step === 'otp' && (
                    <>
                        <div style={otpNoticeStyle}>
                            ✓ Đã gửi mã OTP đến{' '}
                            <strong>{email}</strong>
                        </div>

                        <label className="auth-field">
                            Mã OTP (6 chữ số)

                            <input
                                value={otp}
                                maxLength={6}
                                placeholder="_ _ _ _ _ _"
                                style={otpInputStyle}
                                autoFocus
                                onChange={(event) => {
                                    setOtp(
                                        event.target.value
                                            .replace(/\D/g, ''),
                                    )

                                    setError(null)
                                }}
                            />
                        </label>

                        <label
                            className="auth-field"
                            style={fieldTopStyle}
                        >
                            Mật khẩu mới

                            <input
                                type="password"
                                value={newPassword}
                                placeholder="Tối thiểu 6 ký tự"
                                onChange={(event) => {
                                    setNewPassword(
                                        event.target.value,
                                    )

                                    setError(null)
                                }}
                            />
                        </label>

                        <label
                            className="auth-field"
                            style={fieldTopStyle}
                        >
                            Xác nhận mật khẩu mới

                            <input
                                type="password"
                                value={confirmPassword}
                                placeholder="Nhập lại mật khẩu mới"
                                onChange={(event) => {
                                    setConfirmPassword(
                                        event.target.value,
                                    )

                                    setError(null)
                                }}
                                onKeyDown={handleResetKeyDown}
                            />
                        </label>

                        <button
                            type="button"
                            className="auth-submit"
                            disabled={isLoading}
                            style={resetButtonStyle}
                            onClick={() =>
                                void handleResetPassword()
                            }
                        >
                            {isLoading
                                ? 'Đang xử lý...'
                                : 'Đặt lại mật khẩu'}
                        </button>

                        <button
                            type="button"
                            style={backToEmailButtonStyle}
                            onClick={goBackToEmailStep}
                        >
                            ← Quay lại / Gửi lại OTP
                        </button>
                    </>
                )}

                {step === 'done' && (
                    <div style={doneBoxStyle}>
                        <div style={doneIconStyle}>✅</div>

                        <h3 style={doneTitleStyle}>
                            Đặt lại mật khẩu thành công!
                        </h3>

                        <p style={doneTextStyle}>
                            Mật khẩu đã được cập nhật. Vui lòng đăng
                            nhập lại.
                        </p>

                        <button
                            type="button"
                            className="primary-button"
                            style={doneButtonStyle}
                            onClick={() =>
                                navigate('/login')
                            }
                        >
                            Đăng nhập ngay
                        </button>
                    </div>
                )}
            </section>
        </main>
    )
}

const stepWrapperStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 24,
    gap: 0,
}

const stepItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
}

const stepInnerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
}

const stepCircleStyle: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
}

const stepLabelStyle: CSSProperties = {
    fontSize: 11,
    whiteSpace: 'nowrap',
}

const stepLineStyle: CSSProperties = {
    flex: 1,
    height: 2,
    margin: '0 8px',
    marginBottom: 18,
}

const errorBoxStyle: CSSProperties = {
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
}

const errorCloseButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    fontSize: 16,
    lineHeight: 1,
}

const hintTextStyle: CSSProperties = {
    fontSize: 13,
    color: '#9ca3af',
    margin: '8px 0 20px',
}

const otpNoticeStyle: CSSProperties = {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 20,
    fontSize: 14,
    color: '#166534',
}

const otpInputStyle: CSSProperties = {
    letterSpacing: 8,
    fontSize: 22,
    textAlign: 'center',
    fontWeight: 700,
}

const fieldTopStyle: CSSProperties = {
    marginTop: 14,
}

const resetButtonStyle: CSSProperties = {
    marginTop: 20,
}

const backToEmailButtonStyle: CSSProperties = {
    width: '100%',
    marginTop: 10,
    padding: 10,
    background: 'none',
    border: 'none',
    color: '#7a1030',
    cursor: 'pointer',
    fontSize: 13,
}

const doneBoxStyle: CSSProperties = {
    textAlign: 'center',
    padding: '20px 0',
}

const doneIconStyle: CSSProperties = {
    fontSize: 52,
    marginBottom: 16,
}

const doneTitleStyle: CSSProperties = {
    color: '#065f46',
    marginBottom: 8,
}

const doneTextStyle: CSSProperties = {
    color: '#9ca3af',
    marginBottom: 28,
    fontSize: 14,
}

const doneButtonStyle: CSSProperties = {
    width: '100%',
    padding: '12px',
}