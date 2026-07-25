import {
    useEffect,
    useState,
    type CSSProperties,
} from 'react'

import {cashierApi} from '@/shared/api/cashier'
import type {
    OrderDetailResponse,
    TableDashboardResponse,
} from '@/shared/types/cashier'

export interface CustomerInfo {
    id: number
    fullName: string
    phone: string
    rewardPoints: number
}

interface OrderPanelProps {
    selectedTable: TableDashboardResponse
    orderDetail: OrderDetailResponse | null
    loading: boolean
    onClose: () => void
    onCheckout: () => void
    customer: CustomerInfo | null
    pointsUsed: number
    onCustomerChange: (customer: CustomerInfo | null) => void
    onPointsUsedChange: (points: number) => void
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

function getHttpStatus(error: unknown) {
    if (typeof error !== 'object' || error === null) {
        return undefined
    }

    const requestError = error as {
        response?: {
            status?: number
        }
    }

    return requestError.response?.status
}

function formatCurrency(value: number) {
    return `${value.toLocaleString()} đ`
}

const PHONE_REGEX = /^0[0-9]{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function OrderPanel({
                                       selectedTable,
                                       orderDetail,
                                       loading,
                                       onClose,
                                       onCheckout,
                                       customer,
                                       pointsUsed,
                                       onCustomerChange,
                                       onPointsUsedChange,
                                   }: OrderPanelProps) {
    const itemsList =
        orderDetail?.orderItems ?? []

    const totalAmount =
        orderDetail?.finalAmount ?? 0

    const [isLocking, setIsLocking] =
        useState(false)

    const [lockError, setLockError] =
        useState<string | null>(null)


    const [phoneSearch, setPhoneSearch] =
        useState('')

    const [phoneError, setPhoneError] =
        useState<string | null>(null)

    const [isSearching, setIsSearching] =
        useState(false)

    const [showCreate, setShowCreate] =
        useState(false)

    const [newCusName, setNewCusName] =
        useState('')

    const [newCusEmail, setNewCusEmail] =
        useState('')

    const [processingCreate, setProcessingCreate] =
        useState(false)

    const maxPointsAllowed =
        Math.floor(
            (totalAmount * 0.5) / 1000,
        )

    const maxPointsCanUse =
        customer
            ? Math.min(
                customer.rewardPoints,
                maxPointsAllowed,
            )
            : 0

    const displayStatus =
        selectedTable.status === 'SERVING'
            ? 'Đang Phục Vụ'
            : 'Bàn Trống'

    const isCreateFormValid =
        newCusName.trim().length > 0
        && PHONE_REGEX.test(phoneSearch)
        && EMAIL_REGEX.test(newCusEmail.trim())

    useEffect(() => {
        setLockError(null)
    }, [selectedTable.tableId])

    function handlePhoneInputChange(raw: string) {
        // Chỉ giữ lại ký tự số
        let digitsOnly = raw.replace(/\D/g, '')

        // Giới hạn tối đa 10 số
        digitsOnly = digitsOnly.slice(0, 10)

        setPhoneSearch(digitsOnly)
        setPhoneError(null)
    }

    async function handleSearchCustomer() {
        const phone = phoneSearch.trim()

        if (!phone) {
            setPhoneError('Vui lòng nhập số điện thoại!')
            return
        }

        if (!PHONE_REGEX.test(phone)) {
            setPhoneError(
                'Số điện thoại không hợp lệ! Phải bắt đầu bằng 0 và đủ 10 số.',
            )
            return
        }

        setPhoneError(null)
        setIsSearching(true)
        setShowCreate(false)
        onCustomerChange(null)
        onPointsUsedChange(0)

        try {
            const response =
                await cashierApi.searchCustomer(phone)

            if (response?.data) {
                onCustomerChange(
                    response.data as CustomerInfo,
                )
            }
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            if (getHttpStatus(requestError) === 404) {
                setShowCreate(true)
                return
            }

            console.error(
                '[CASHIER_CUSTOMER_SEARCH_ERROR]',
                requestError,
            )

            alert('Lỗi tìm kiếm khách hàng!')
        } finally {
            setIsSearching(false)
        }
    }

    async function handleCreateCustomer() {
        const phone = phoneSearch.trim()
        const fullName = newCusName.trim()
        const email = newCusEmail.trim()

        if (!fullName) {
            alert('Vui lòng nhập tên khách hàng!')
            return
        }

        if (
            !phone
            || !/^0[0-9]{9}$/.test(phone)
        ) {
            alert(
                'Số điện thoại không hợp lệ! Phải bắt đầu bằng 0 và đủ 10 số.',
            )
            return
        }

        if (
            !email
            || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            alert('Vui lòng nhập email hợp lệ!')
            return
        }

        setProcessingCreate(true)

        try {
            const response =
                await cashierApi.createCustomerFast({
                    fullName,
                    phone,
                    email,
                })

            if (response?.data) {
                onCustomerChange(
                    response.data as CustomerInfo,
                )

                setShowCreate(false)

                alert('Đăng ký thành viên thành công!')
            }
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[CASHIER_CUSTOMER_CREATE_ERROR]',
                requestError,
            )

            alert(
                'Lỗi tạo khách hàng. Có thể số điện thoại đã tồn tại!',
            )
        } finally {
            setProcessingCreate(false)
        }
    }

    function handleClearCustomer() {
        onCustomerChange(null)
        onPointsUsedChange(0)
        setPhoneSearch('')
        setShowCreate(false)
        setNewCusName('')
        setNewCusEmail('')
    }

    function handlePointsInputChange(raw: number) {
        const safeValue =
            Math.max(
                0,
                Math.min(
                    raw,
                    maxPointsCanUse,
                ),
            )

        onPointsUsedChange(safeValue)
    }

    async function handleCheckoutClick() {
        if (!orderDetail) {
            setLockError('Chưa có thông tin đơn hàng để thanh toán!')
            return
        }

        setLockError(null)
        setIsLocking(true)

        try {
            const response =
                await cashierApi.processPaymentLock(
                    orderDetail.orderId,
                    {
                        paymentMethod: 'CASH',
                        amountPaid: 0,
                    },
                )

            if (response.data.success) {
                onCheckout()
                return
            }

            setLockError(
                response.data.message
                ?? 'Đơn hàng còn món chưa hoàn thành hoặc chưa hủy. Hãy hoàn thành để có thể thanh toán.',
            )
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[CASHIER_PAYMENT_LOCK_ERROR]',
                requestError,
            )

            setLockError('Không thể thực hiện thanh toán đơn hàng.Vui lòng huỷ hoặc hoàn thành các món còn lại!')
        } finally {
            setIsLocking(false)
        }
    }

    return (
        <div
            className="page-card"
            style={{
                position: 'relative',
                width: 'min(400px, 50vw)',
                maxWidth: '100%',
                boxSizing: 'border-box',
                // swap the line above for the two below instead.
                // transform: 'scale(0.55)',
                // transformOrigin: 'top left',
            }}
        >
            <button
                type="button"
                style={closeButtonStyle}
                onClick={onClose}
            >
                ✖
            </button>

            <h2>Chi tiết đơn hàng</h2>

            <div style={headerInfoStyle}>
                <strong>
                    Vị trí: {selectedTable.tableNumber}
                </strong>

                <span style={statusBadgeStyle}>
                    {displayStatus}
                </span>
            </div>

            {selectedTable.status === 'SERVING' && (
                <div style={customerBoxStyle}>
                    <h4 style={customerTitleStyle}>
                        🌟 Tích Điểm Thành Viên
                    </h4>

                    <div
                        style={{
                            display: 'flex',
                            gap: '8px',
                        }}
                    >
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Nhập SĐT khách hàng..."
                            style={customerInputStyle}
                            value={phoneSearch}
                            disabled={!!customer}
                            pattern="0[0-9]{9}"
                            onChange={(event) =>
                                handlePhoneInputChange(event.target.value)
                            }
                        />

                        {customer ? (
                            <button
                                type="button"
                                style={dangerButtonStyle}
                                onClick={handleClearCustomer}
                            >
                                Bỏ chọn
                            </button>
                        ) : (
                            <button
                                type="button"
                                style={{
                                    ...searchButtonStyle,
                                    opacity:
                                        !PHONE_REGEX.test(phoneSearch) || isSearching
                                            ? 0.6
                                            : 1,
                                    cursor:
                                        !PHONE_REGEX.test(phoneSearch) || isSearching
                                            ? 'not-allowed'
                                            : 'pointer',
                                }}
                                disabled={
                                    !PHONE_REGEX.test(phoneSearch) || isSearching
                                }
                                onClick={() =>
                                    void handleSearchCustomer()
                                }
                            >
                                {isSearching ? '...' : 'Tìm'}
                            </button>
                        )}
                    </div>

                    {phoneError && (
                        <div
                            style={{
                                color: '#dc2626',
                                fontSize: '0.85rem',
                                marginTop: '4px',
                            }}
                        >
                            ⚠️ {phoneError}
                        </div>
                    )}

                    {showCreate && !customer && (
                        <div style={createCustomerBoxStyle}>
                            <p style={createCustomerTitleStyle}>
                                Chưa có tài khoản! Đăng ký nhanh:
                            </p>

                            <div style={phoneHintStyle}>
                                SĐT dùng để đăng ký:{' '}
                                <strong>{phoneSearch}</strong>
                            </div>

                            <input
                                type="text"
                                placeholder="Tên khách hàng (*)"
                                style={stackedInputStyle}
                                value={newCusName}
                                onChange={(event) =>
                                    setNewCusName(
                                        event.target.value,
                                    )
                                }
                            />

                            <input
                                type="email"
                                placeholder="Email (*)"
                                style={stackedInputStyle}
                                value={newCusEmail}
                                onChange={(event) =>
                                    setNewCusEmail(
                                        event.target.value,
                                    )
                                }
                            />

                            <button
                                type="button"
                                style={{
                                    ...createCustomerButtonStyle,
                                    opacity:
                                        !isCreateFormValid || processingCreate
                                            ? 0.6
                                            : 1,
                                    cursor:
                                        !isCreateFormValid || processingCreate
                                            ? 'not-allowed'
                                            : 'pointer',
                                }}
                                disabled={
                                    !isCreateFormValid || processingCreate
                                }
                                onClick={() =>
                                    void handleCreateCustomer()
                                }
                            >
                                {processingCreate
                                    ? 'Đang tạo...'
                                    : 'Tạo Tài Khoản'}
                            </button>
                        </div>
                    )}

                    {customer && (
                        <div style={customerFoundBoxStyle}>
                            <p style={compactParagraphStyle}>
                                👤 Khách:{' '}
                                <strong>{customer.fullName}</strong>
                            </p>

                            <p style={pointsParagraphStyle}>
                                💰 Điểm hiện có:{' '}
                                <strong
                                    style={{
                                        color: '#059669',
                                    }}
                                >
                                    {customer.rewardPoints.toLocaleString()}
                                </strong>
                            </p>

                            {customer.rewardPoints > 0 && (
                                <label style={pointsLabelStyle}>
                                    Sử dụng điểm
                                    {' '}
                                    (Tối đa {maxPointsCanUse.toLocaleString()}):
                                    <input
                                        type="number"
                                        min="0"
                                        max={maxPointsCanUse}
                                        style={pointsInputStyle}
                                        value={pointsUsed || ''}
                                        onChange={(event) =>
                                            handlePointsInputChange(
                                                Number(
                                                    event.target.value,
                                                ),
                                            )
                                        }
                                    />
                                </label>
                            )}
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <p>Đang tải thông tin đơn hàng...</p>
            ) : !orderDetail ? (
                <p
                    style={{
                        color: '#64748b',
                    }}
                >
                    Chưa có thông tin đơn hàng cho bàn này.
                </p>
            ) : (
                <div>
                    <div
                        className="simple-table"
                        style={{
                            display: 'grid',
                            minWidth: 0,
                            width: '100%',
                        }}
                    >
                        <div
                            className="simple-table-header"
                            style={orderHeaderStyle}
                        >
                            <span style={cellStyle}>Món ăn</span>
                            <span style={cellStyle}>SL</span>
                            <span
                                style={{
                                    ...cellStyle,
                                    textAlign: 'right',
                                }}
                            >
                                Thành tiền
                            </span>
                        </div>

                        <div style={orderListStyle}>
                            {itemsList.length === 0 ? (
                                <p style={emptyItemsStyle}>
                                    Bàn hiện tại chưa có món nào hoàn thành.
                                </p>
                            ) : (
                                itemsList.map((item, index) => (
                                    <div
                                        key={`${item.dishName}-${index}`}
                                        className="simple-table-row"
                                        style={orderRowStyle}
                                    >
                                        <span style={cellStyle}>{item.dishName}</span>
                                        <span style={cellStyle}>x{item.quantity}</span>
                                        <span
                                            style={{
                                                ...cellStyle,
                                                textAlign: 'right',
                                            }}
                                        >
                                            {formatCurrency(
                                                item.subTotal,
                                            )}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div style={summaryBoxStyle}>
                        <div style={summaryLinesStyle}>
                            <div style={summaryLineStyle}>
                                <span>Tạm tính trước thuế:</span>
                                <span>
                                    {formatCurrency(
                                        orderDetail.totalAmountBeforeVat ?? 0,
                                    )}
                                </span>
                            </div>

                            <div style={summaryLineStyle}>
                                <span>Thuế VAT (10%):</span>
                                <span>
                                    {formatCurrency(
                                        orderDetail.vatAmount ?? 0,
                                    )}
                                </span>
                            </div>

                            {pointsUsed > 0 && (
                                <div
                                    style={{
                                        ...summaryLineStyle,
                                        color: '#059669',
                                    }}
                                >
                                    <span>
                                        Giảm giá ({pointsUsed} điểm):
                                    </span>
                                    <span>
                                        -{formatCurrency(pointsUsed * 1000)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div style={totalLineStyle}>
                            <span>Tổng thanh toán:</span>
                            <strong
                                style={{
                                    color: '#b91c1c',
                                }}
                            >
                                {formatCurrency(
                                    totalAmount - pointsUsed * 1000,
                                )}
                            </strong>
                        </div>

                        {lockError && (
                            <div style={lockErrorBoxStyle}>
                                ⚠️ {lockError}
                            </div>
                        )}

                        {selectedTable.status === 'SERVING' && (
                            <button
                                type="button"
                                className="primary-button"
                                style={{
                                    marginTop: '1rem',
                                    width: '100%',
                                    opacity: isLocking ? 0.7 : 1,
                                }}
                                disabled={isLocking}
                                onClick={() =>
                                    void handleCheckoutClick()
                                }
                            >
                                {isLocking
                                    ? 'Đang khóa đơn...'
                                    : 'CheckOut'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const closeButtonStyle: CSSProperties = {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    background: 'none',
    border: 'none',
    fontSize: '1.4rem',
    cursor: 'pointer',
    color: '#64748b',
    fontWeight: 'bold',
}

const headerInfoStyle: CSSProperties = {
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #e2e8f0',
    marginTop: '0.5rem',
}

const statusBadgeStyle: CSSProperties = {
    marginLeft: '10px',
    float: 'right',
    background: '#ffedd5',
    color: '#ea580c',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
}

const customerBoxStyle: CSSProperties = {
    background: '#f8fafc',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '1.5rem',
}

const customerTitleStyle: CSSProperties = {
    margin: '0 0 10px 0',
    color: '#334155',
}

const customerInputStyle: CSSProperties = {
    flex: 1,
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
}

const dangerButtonStyle: CSSProperties = {
    padding: '8px 16px',
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
}

const searchButtonStyle: CSSProperties = {
    padding: '8px 16px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
}

const createCustomerBoxStyle: CSSProperties = {
    marginTop: '10px',
    padding: '10px',
    background: '#fff',
    border: '1px dashed #cbd5e1',
    borderRadius: '6px',
}

const createCustomerTitleStyle: CSSProperties = {
    margin: '0 0 8px 0',
    fontSize: '0.9rem',
    color: '#ef4444',
    fontWeight: 'bold',
}

const phoneHintStyle: CSSProperties = {
    padding: '8px',
    marginBottom: '6px',
    background: '#f1f5f9',
    borderRadius: '4px',
    fontSize: '0.85rem',
    color: '#475569',
}

const stackedInputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px',
    marginBottom: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
}

const createCustomerButtonStyle: CSSProperties = {
    width: '100%',
    padding: '8px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
}

const customerFoundBoxStyle: CSSProperties = {
    marginTop: '10px',
    padding: '10px',
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '6px',
}

const compactParagraphStyle: CSSProperties = {
    margin: '0 0 5px 0',
}

const pointsParagraphStyle: CSSProperties = {
    margin: '0 0 10px 0',
}

const pointsLabelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.9rem',
}

const pointsInputStyle: CSSProperties = {
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    boxSizing: 'border-box',
}

const orderHeaderStyle: CSSProperties = {
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
    display: 'grid',
    fontWeight: 'bold',
    borderBottom: '1px solid #cbd5e1',
    paddingBottom: '4px',
    minWidth: 0,
}

const orderListStyle: CSSProperties = {
    maxHeight: '220px',
    overflowY: 'auto',
    margin: '0.5rem 0',
}

const emptyItemsStyle: CSSProperties = {
    textAlign: 'center',
    color: '#94a3b8',
    margin: '1rem 0',
}

const orderRowStyle: CSSProperties = {
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
    display: 'grid',
    padding: '6px 0',
    borderBottom: '1px dashed #f1f5f9',
    minWidth: 0,
}

const summaryBoxStyle: CSSProperties = {
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #e2e8f0',
}

const summaryLinesStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.9rem',
    color: '#475569',
    marginBottom: '8px',
}

const summaryLineStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
}

const totalLineStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1.05rem',
    fontWeight: 'bold',
}

const lockErrorBoxStyle: CSSProperties = {
    marginTop: '0.75rem',
    padding: '0.6rem 0.75rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#b91c1c',
    fontSize: '0.9rem',
    lineHeight: 1.4,
}

const cellStyle: CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
}