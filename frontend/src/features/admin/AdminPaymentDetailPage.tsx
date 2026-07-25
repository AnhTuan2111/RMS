import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react'
import {
    useNavigate,
    useParams,
} from 'react-router-dom'

import {
    adminApi,
    type AdminPaymentDetail,
} from '@/shared/api/admin'
import {
    ErrorState,
    LoadingState,
} from '@/shared/components/feedback'

function formatCurrency(value: number) {
    return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

function formatTime(value: string) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function formatDate(value: string) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date)
}

function formatTableName(tableNumber: string) {
    if (!tableNumber) {
        return 'Mang về'
    }

    if (tableNumber.toLowerCase().startsWith('bàn')) {
        return tableNumber
    }

    return tableNumber
}

function formatPaymentMethod(method: string) {
    switch (method) {
        case 'CASH':
            return 'Tiền mặt'
        case 'QRCODE':
            return 'VNPay / QR Code'
        default:
            return method
    }
}

export default function AdminPaymentDetailPage() {
    const navigate = useNavigate()
    const {invoiceId} = useParams()

    const parsedInvoiceId = Number(invoiceId)

    const hasValidInvoiceId =
        Boolean(invoiceId)
        && Number.isFinite(parsedInvoiceId)

    const [payment, setPayment] =
        useState<AdminPaymentDetail | null>(null)

    const [isLoading, setIsLoading] =
        useState(true)

    const [error, setError] =
        useState<string | null>(null)

    const requestIdRef = useRef(0)

    const loadPaymentDetail = useCallback(
        async (showFullLoading = true) => {
            if (!hasValidInvoiceId) {
                setIsLoading(false)
                setError('Mã hóa đơn không hợp lệ.')
                return
            }

            const requestId = ++requestIdRef.current

            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                setError(null)

                const {data} =
                    await adminApi.getPaymentDetail(
                        parsedInvoiceId,
                    )

                if (requestId !== requestIdRef.current) {
                    return
                }

                setPayment(data)
            } catch (requestError: unknown) {
                if (requestId !== requestIdRef.current) {
                    return
                }

                console.error(
                    '[ADMIN_PAYMENT_DETAIL_FETCH_ERROR]',
                    requestError,
                )

                setError(
                    'Không thể tải chi tiết hóa đơn.',
                )
            } finally {
                if (
                    requestId === requestIdRef.current
                    && showFullLoading
                ) {
                    setIsLoading(false)
                }
            }
        },
        [
            hasValidInvoiceId,
            parsedInvoiceId,
        ],
    )

    useEffect(() => {
        if (!hasValidInvoiceId) {
            return
        }

        void loadPaymentDetail(true)

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasValidInvoiceId, loadPaymentDetail])

    if (!hasValidInvoiceId) {
        return (
            <div className="admin-invoice-detail-page">
                <div className="admin-invoice-detail-gradient"/>
                <div className="admin-invoice-detail-card admin-invoice-detail-state">
                    <h2>Không thể tải dữ liệu</h2>
                    <p>Mã hóa đơn không hợp lệ.</p>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <LoadingState
                title="Đang tải chi tiết hóa đơn..."
                description="Hệ thống đang lấy thông tin hóa đơn và danh sách món ăn."
            />
        )
    }

    if (error || !payment) {
        return (
            <ErrorState
                title="Không thể tải dữ liệu"
                message={
                    error ?? 'Không tìm thấy hóa đơn.'
                }
                onRetry={() => {
                    loadPaymentDetail(true)
                        .catch((requestError) => {
                            console.error(requestError)
                        })
                }}
            />
        )
    }

    return (
        <div className="admin-invoice-detail-page">
            {/* Gradient bar trên cùng */}
            <div className="admin-invoice-detail-gradient"/>

            {/* ═══ KHỐI 1: Thông tin hóa đơn + Bảng món ăn ═══ */}
            <div className="admin-invoice-detail-card">
                {/* Header: Nút quay lại + Tiêu đề + Phụ đề */}
                <div className="admin-invoice-detail-header">
                    <button
                        aria-label="Quay lại lịch sử hóa đơn"
                        className="admin-invoice-detail-back-button"
                        type="button"
                        onClick={() => navigate(-1)}
                    >
                        ‹
                    </button>

                    <div>
                        <h1>Hóa đơn ORD-{payment.orderId}</h1>

                        <p>
                            Bàn: {formatTableName(payment.tableNumber)}
                            {' · '}
                            Giờ: {formatTime(payment.invoiceDate)}
                            {' '}
                            {formatDate(payment.invoiceDate)}
                        </p>
                    </div>
                </div>

                {/* Bảng danh sách món ăn */}
                <div className="admin-invoice-detail-table">
                    <div className="admin-invoice-detail-table-head">
                        <span>MÓN ĂN</span>
                        <span>SL</span>
                        <span>ĐƠN GIÁ</span>
                        <span>THÀNH TIỀN</span>
                    </div>

                    {payment.items.length === 0 ? (
                        <div className="admin-invoice-detail-empty">
                            Hóa đơn này chưa có món ăn.
                        </div>
                    ) : (
                        payment.items.map((item, index) => (
                            <div
                                className="admin-invoice-detail-row"
                                key={`${item.dishName}-${index}`}
                            >
                                <span className="admin-invoice-dish-name">
                                    {item.dishName}
                                </span>

                                <span className="admin-invoice-qty">
                                    {item.quantity}
                                </span>

                                <span className="admin-invoice-price">
                                    {formatCurrency(item.unitPrice)}
                                </span>

                                <span className="admin-invoice-line-total">
                                    {formatCurrency(item.amount)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ═══ KHỐI 2: Tổng kết thanh toán ═══ */}
            <div className="admin-invoice-detail-card">
                <div className="admin-invoice-summary-card">
                    {/* Tạm tính */}
                    <div className="admin-invoice-summary-row">
                        <span>Tạm tính</span>
                        <span>{formatCurrency(payment.totalBeforeVat)}</span>
                    </div>

                    {/* VAT */}
                    <div className="admin-invoice-summary-row">
                        <span>VAT (10%)</span>
                        <span>{formatCurrency(payment.vatAmount)}</span>
                    </div>

                    {/* THÀNH TIỀN - highlight đỏ */}
                    <div className="admin-invoice-summary-row admin-invoice-summary-row-total">
                        <span>THÀNH TIỀN</span>
                        <span className="admin-invoice-summary-highlight">
                            {formatCurrency(payment.finalAmount)}
                        </span>
                    </div>

                    {/* Phương thức */}
                    <div className="admin-invoice-summary-row">
                        <span>Phương thức</span>
                        <span>{formatPaymentMethod(payment.paymentMethod)}</span>
                    </div>

                    {/* Khách trả */}
                    <div className="admin-invoice-summary-row">
                        <span>Khách trả</span>
                        <span>{formatCurrency(payment.amountPaid)}</span>
                    </div>

                    {/* Tiền thừa */}
                    <div className="admin-invoice-summary-row">
                        <span>Tiền thừa</span>
                        <span>{formatCurrency(payment.excessAmount)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}