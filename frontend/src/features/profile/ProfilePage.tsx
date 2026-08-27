import {useCallback, useEffect, useRef, useState, type CSSProperties} from 'react'

import * as adminApi from '@/shared/api/admin'
import * as customerApi from '@/shared/api/customer'
import {useActor} from '@/app/providers/ActorContext'
import {RoleType} from '@/shared/types/auth'
import {getErrorMessage, isRequestCanceled} from '@/shared/utils/error'

type StoredUser = {
    userId: number
    id?: number
    username: string
    fullName: string
    phone: string
    email: string | null
    role: string
    rewardPoints?: number
}

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    CHEF: 'Đầu bếp',
    WAITER: 'Phục vụ',
    CASHIER: 'Thu ngân',
    CUSTOMER: 'Khách hàng',
}

function readStoredUser() {
    const stored = localStorage.getItem('currentUser')

    if (!stored) {
        return null
    }

    try {
        return JSON.parse(stored) as StoredUser
    } catch {
        return null
    }
}

function getUserId(user: StoredUser) {
    return user.userId ?? user.id ?? 0
}

function persistUser(user: StoredUser) {
    localStorage.setItem('currentUser', JSON.stringify(user))
}

function normalizeCustomerProfile(
    profile: {
        id?: number
        userId?: number
        username: string
        fullName: string
        phone: string
        email: string | null
        role: string
        rewardPoints?: number
    },
    fallback: StoredUser | null,
): StoredUser {
    return {
        userId: profile.userId ?? profile.id ?? fallback?.userId ?? fallback?.id ?? 0,

        id: profile.id ?? fallback?.id,

        username: profile.username,
        fullName: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        role: profile.role,
        rewardPoints: profile.rewardPoints ?? fallback?.rewardPoints ?? 0,
    }
}

export default function ProfilePage() {
    const {actor} = useActor()

    const [savedUser, setSavedUser] = useState<StoredUser | null>(() => readStoredUser())

    const [isEditing, setIsEditing] = useState(false)

    const [fullName, setFullName] = useState(savedUser?.fullName ?? '')

    const [username, setUsername] = useState(savedUser?.username ?? '')

    const [email, setEmail] = useState(savedUser?.email ?? '')

    const [phone, setPhone] = useState(savedUser?.phone ?? '')

    const [updateLoading, setUpdateLoading] = useState(false)

    const [updateError, setUpdateError] = useState<string | null>(null)

    const [updateSuccess, setUpdateSuccess] = useState(false)

    const [showChangePw, setShowChangePw] = useState(false)

    const [currentPw, setCurrentPw] = useState('')

    const [newPw, setNewPw] = useState('')

    const [confirmPw, setConfirmPw] = useState('')

    const [pwLoading, setPwLoading] = useState(false)

    const [pwError, setPwError] = useState<string | null>(null)

    const [pwSuccess, setPwSuccess] = useState(false)

    const isCustomer =
        actor === RoleType.CUSTOMER || savedUser?.role === RoleType.CUSTOMER

    const isAdmin = actor === RoleType.ADMIN || savedUser?.role === RoleType.ADMIN

    const canEditProfile = isCustomer || isAdmin

    // Các setter của useState vốn ổn định, nên deps rỗng là đủ.
    const syncFormFromUser = useCallback((user: StoredUser) => {
        setUsername(user.username)
        setFullName(user.fullName)
        setEmail(user.email ?? '')
        setPhone(user.phone)
    }, [])

    // loadCustomerProfile ghi lại savedUser. Nếu đưa savedUser/isEditing vào deps thì
    // effect bên dưới sẽ chạy lại sau mỗi lần fetch -> vòng lặp vô hạn. Giữ chúng
    // trong ref để đọc được giá trị mới nhất mà không tạo phụ thuộc.
    const latestProfileRef = useRef({savedUser, isEditing})

    useEffect(() => {
        latestProfileRef.current = {savedUser, isEditing}
    })

    const loadCustomerProfile = useCallback(
        async (signal?: AbortSignal) => {
            if (!isCustomer) {
                return
            }

            try {
                const profile = await customerApi.getMyProfile(signal)

                if (signal?.aborted) {
                    return
                }

                const {savedUser: latestUser, isEditing: isEditingNow} =
                    latestProfileRef.current

                const nextUser = normalizeCustomerProfile(profile, latestUser)

                setSavedUser(nextUser)
                persistUser(nextUser)

                // Đang sửa dở thì không ghi đè những gì người dùng vừa gõ.
                if (!isEditingNow) {
                    syncFormFromUser(nextUser)
                }
            } catch (requestError: unknown) {
                if (signal?.aborted || isRequestCanceled(requestError)) {
                    return
                }

                console.error('[PROFILE_CUSTOMER_FETCH_ERROR]', requestError)
            }
        },
        [isCustomer, syncFormFromUser],
    )

    // Điểm thưởng thay đổi mỗi lần khách thanh toán, nhưng savedUser chỉ được ghi lúc
    // đăng nhập. Không đọc lại từ server thì màn hình sẽ hiển thị điểm cũ mãi.
    useEffect(() => {
        const controller = new AbortController()

        void loadCustomerProfile(controller.signal)

        return () => controller.abort()
    }, [loadCustomerProfile])

    if (!savedUser) {
        return (
            <div className="page-card">
                <p>Không tìm thấy thông tin người dùng.</p>
            </div>
        )
    }

    const currentUser = savedUser

    async function handleSaveProfile() {
        if (!canEditProfile) {
            return
        }

        setUpdateLoading(true)
        setUpdateError(null)

        try {
            const userId = getUserId(currentUser)

            if (!userId) {
                throw new Error('Không xác định được tài khoản cần cập nhật.')
            }

            const data = {
                fullName,
                username,
                email,
                phone,
            }

            let updated
            if (isCustomer) {
                updated = await customerApi.updateMyProfile({
                    fullName,
                    username,
                    email,
                    phone,
                })
            } else {
                updated = await adminApi.updateProfile(userId, data)
            }
            const nextUser: StoredUser = {
                ...currentUser,
                userId:
                    ((updated as unknown as Record<string, unknown>).userId as number) ??
                    ((updated as unknown as Record<string, unknown>).id as number) ??
                    currentUser.userId,
                username: updated.username,
                fullName: updated.fullName,
                email: updated.email,
                phone: updated.phone,
                role: updated.role,
                rewardPoints: updated.rewardPoints ?? currentUser.rewardPoints,
            }

            persistUser(nextUser)
            setSavedUser(nextUser)
            syncFormFromUser(nextUser)

            setIsEditing(false)
            setUpdateSuccess(true)

            window.setTimeout(() => setUpdateSuccess(false), 3000)
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[PROFILE_UPDATE_ERROR]', requestError)

            setUpdateError(getErrorMessage(requestError))
        } finally {
            setUpdateLoading(false)
        }
    }

    async function handleChangePassword() {
        if (newPw !== confirmPw) {
            setPwError('Mật khẩu xác nhận không khớp')
            return
        }

        if (newPw.length < 6) {
            setPwError('Mật khẩu mới phải có ít nhất 6 ký tự')
            return
        }

        setPwLoading(true)
        setPwError(null)

        try {
            await customerApi.changePassword({
                currentPassword: currentPw,
                newPassword: newPw,
            })

            setCurrentPw('')
            setNewPw('')
            setConfirmPw('')
            setShowChangePw(false)
            setPwSuccess(true)

            window.setTimeout(() => setPwSuccess(false), 3000)
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[PROFILE_CHANGE_PASSWORD_ERROR]', requestError)

            setPwError(getErrorMessage(requestError))
        } finally {
            setPwLoading(false)
        }
    }

    return (
        <div className="page-card">
            <div className="page-header">
                <div>
                    <h2>Hồ sơ cá nhân</h2>
                    <p>Xem và cập nhật thông tin tài khoản của bạn.</p>
                </div>

                {!isEditing && canEditProfile && (
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => setIsEditing(true)}
                    >
                        Chỉnh sửa
                    </button>
                )}
            </div>

            {updateSuccess && (
                <div style={successStyle}>✓ Cập nhật hồ sơ thành công!</div>
            )}

            {pwSuccess && <div style={successStyle}>✓ Đổi mật khẩu thành công!</div>}

            <div style={cardStyle}>
                <div style={profileHeaderStyle}>
                    <div style={avatarStyle}>
                        {currentUser.fullName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                        <h3 style={profileNameStyle}>{currentUser.fullName}</h3>

                        <span style={roleBadgeStyle}>
                            {ROLE_LABELS[currentUser.role] ?? currentUser.role}
                        </span>
                    </div>
                </div>

                <div style={fieldGridStyle}>
                    {isEditing ? (
                        <>
                            <EditField
                                label="Họ tên *"
                                value={fullName}
                                placeholder="Nguyễn Văn A"
                                onChange={setFullName}
                            />

                            <EditField
                                label="Username *"
                                value={username}
                                placeholder="abc"
                                onChange={setUsername}
                            />

                            <EditField
                                label="Email"
                                type="email"
                                value={email}
                                placeholder="email@example.com"
                                onChange={setEmail}
                            />

                            <EditField
                                label="Số điện thoại *"
                                value={phone}
                                pattern="0[0-9]{9}"
                                placeholder="0xxxxxxxxx"
                                onChange={setPhone}
                            />
                        </>
                    ) : (
                        <>
                            <ProfileField label="Họ tên" value={currentUser.fullName} />

                            <ProfileField label="Username" value={currentUser.username} />

                            <ProfileField
                                label="Email"
                                value={currentUser.email ?? '—'}
                            />

                            <ProfileField
                                label="Số điện thoại"
                                value={currentUser.phone}
                            />

                            {isCustomer && (
                                <ProfileField
                                    label="Điểm tích lũy"
                                    value={`${currentUser.rewardPoints ?? 0} điểm`}
                                />
                            )}
                        </>
                    )}
                </div>

                {updateError && (
                    <div className="auth-error" style={profileErrorStyle}>
                        {updateError}
                    </div>
                )}

                {isEditing && (
                    <div style={profileActionStyle}>
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                                setIsEditing(false)
                                syncFormFromUser(currentUser)
                                setUpdateError(null)
                            }}
                        >
                            Hủy
                        </button>

                        <button
                            type="button"
                            className="primary-button"
                            disabled={updateLoading}
                            onClick={() => void handleSaveProfile()}
                        >
                            {updateLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                    </div>
                )}
            </div>

            {isCustomer && (
                <div style={passwordCardStyle}>
                    <div style={passwordHeaderStyle}>
                        <div>
                            <h3 style={passwordTitleStyle}>Đổi mật khẩu</h3>

                            <p style={passwordSubtitleStyle}>
                                Cập nhật mật khẩu để bảo mật tài khoản
                            </p>
                        </div>

                        <button
                            type="button"
                            className={
                                showChangePw ? 'secondary-button' : 'primary-button'
                            }
                            onClick={() => {
                                setShowChangePw(!showChangePw)
                                setPwError(null)
                            }}
                        >
                            {showChangePw ? 'Hủy' : 'Đổi mật khẩu'}
                        </button>
                    </div>

                    {showChangePw && (
                        <div style={passwordFormStyle}>
                            <EditField
                                label="Mật khẩu hiện tại *"
                                type="password"
                                value={currentPw}
                                placeholder="••••••"
                                onChange={setCurrentPw}
                            />

                            <EditField
                                label="Mật khẩu mới *"
                                type="password"
                                value={newPw}
                                placeholder="Tối thiểu 6 ký tự"
                                onChange={setNewPw}
                            />

                            <EditField
                                label="Xác nhận mật khẩu mới *"
                                type="password"
                                value={confirmPw}
                                placeholder="Nhập lại mật khẩu mới"
                                onChange={setConfirmPw}
                            />

                            {pwError && <div className="auth-error">{pwError}</div>}

                            <div style={passwordActionStyle}>
                                <button
                                    type="button"
                                    className="primary-button"
                                    disabled={pwLoading}
                                    onClick={() => void handleChangePassword()}
                                >
                                    {pwLoading
                                        ? 'Đang xử lý...'
                                        : 'Xác nhận đổi mật khẩu'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function ProfileField({
    label,
    value,
    readOnly,
}: {
    label: string
    value: string
    readOnly?: boolean
}) {
    return (
        <div style={profileFieldStyle}>
            <span style={profileFieldLabelStyle}>{label}</span>

            <span
                style={{
                    ...profileFieldValueStyle,
                    color: readOnly ? '#9ca3af' : '#111827',
                }}
            >
                {value}
            </span>
        </div>
    )
}

function EditField({
    label,
    value,
    onChange,
    placeholder,
    pattern,
    type = 'text',
}: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    pattern?: string
    type?: string
}) {
    const [visible, setVisible] = useState(false)

    const isPassword = type === 'password'

    const inputType = isPassword ? (visible ? 'text' : 'password') : type

    return (
        <label style={editFieldStyle}>
            {label}

            <div style={editInputWrapperStyle}>
                <input
                    type={inputType}
                    value={value}
                    placeholder={placeholder}
                    pattern={pattern}
                    style={{
                        ...editInputStyle,
                        padding: isPassword ? '10px 40px 10px 12px' : '10px 12px',
                    }}
                    onChange={(event) => onChange(event.target.value)}
                />

                {isPassword && (
                    <button
                        type="button"
                        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        style={eyeButtonStyle}
                        onClick={() => setVisible((current) => !current)}
                        onMouseEnter={(event) => {
                            event.currentTarget.style.color = '#4f46e5'
                            event.currentTarget.style.backgroundColor = '#eef2ff'
                        }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.color = '#9ca3af'
                            event.currentTarget.style.backgroundColor = 'transparent'
                        }}
                    >
                        {visible ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                )}
            </div>
        </label>
    )
}

function EyeIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}

function EyeOffIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.62 21.62 0 0 1 5.06-6.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-3.22 4.36M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    )
}

const cardStyle: CSSProperties = {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
}

const passwordCardStyle: CSSProperties = {
    ...cardStyle,
    marginTop: '16px',
}

const avatarStyle: CSSProperties = {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#4f46e5',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 700,
    flexShrink: 0,
}

const successStyle: CSSProperties = {
    background: '#d1fae5',
    color: '#065f46',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontWeight: 500,
}

const profileHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '28px',
}

const profileNameStyle: CSSProperties = {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
}

const roleBadgeStyle: CSSProperties = {
    background: '#e0e7ff',
    color: '#4338ca',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
}

const fieldGridStyle: CSSProperties = {
    display: 'grid',
    gap: '16px',
}

const profileErrorStyle: CSSProperties = {
    marginTop: '12px',
}

const profileActionStyle: CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '20px',
    justifyContent: 'flex-end',
}

const passwordHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
}

const passwordTitleStyle: CSSProperties = {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
}

const passwordSubtitleStyle: CSSProperties = {
    margin: '4px 0 0',
    color: '#9ca3af',
    fontSize: '13px',
}

const passwordFormStyle: CSSProperties = {
    display: 'grid',
    gap: '16px',
    marginTop: '20px',
}

const passwordActionStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
}

const profileFieldStyle: CSSProperties = {
    display: 'flex',
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
    gap: '16px',
}

const profileFieldLabelStyle: CSSProperties = {
    width: '160px',
    color: '#9ca3af',
    fontSize: '13px',
    flexShrink: 0,
}

const profileFieldValueStyle: CSSProperties = {
    fontWeight: 500,
    fontSize: '14px',
}

const editFieldStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
}

const editInputWrapperStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
}

const editInputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
}

const eyeButtonStyle: CSSProperties = {
    position: 'absolute',
    right: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: '#9ca3af',
    transition: 'color 0.15s ease, background-color 0.15s ease',
}
