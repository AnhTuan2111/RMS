import {useEffect, useState, type CSSProperties} from 'react'

import * as cashierApi from '@/shared/api/cashier'
import type {
    OrderDetailResponse,
    PaymentMethodType,
    PaymentResponse,
} from '@/shared/types/cashier'
import type {CustomerInfo} from './OrderPanel'
import {isRequestCanceled} from '@/shared/utils/error'

interface PaymentModalProps {
    orderId: number
    orderDetail: OrderDetailResponse
    customer: CustomerInfo | null
    pointsUsed: number
    onClose: () => void
    onSuccess: (result: PaymentResponse) => void
}

function formatCurrency(value: number) {
    return `${value.toLocaleString()} đ`
}

function methodDisplay(method: string) {
    if (method === 'CASH') return {icon: '💵', label: 'Tiền mặt'}
    if (method === 'QRCODE') return {icon: '💳', label: 'Thẻ / VNPay'}
    return {icon: '💳', label: method}
}

export default function PaymentModal({
    orderId,
    orderDetail,
    customer,
    pointsUsed,
    onClose,
    onSuccess,
}: PaymentModalProps) {
    const [method, setMethod] = useState<PaymentMethodType | null>(null)

    const [amountReceived, setAmountReceived] = useState<number>(0)

    const [processing, setProcessing] = useState<boolean>(false)

    const [paymentMethods, setPaymentMethods] = useState<string[]>([])

    const [loadingMethods, setLoadingMethods] = useState<boolean>(true)

    const originalFinalAmount = orderDetail.finalAmount

    const discountAmount = pointsUsed * 1000

    const finalAmount = Math.max(0, originalFinalAmount - discountAmount)

    const changeReturned =
        amountReceived >= finalAmount ? amountReceived - finalAmount : 0

    useEffect(() => {
        let active = true
        const controller = new AbortController()

        cashierApi
            .getPaymentMethods(controller.signal)
            .then((response) => {
                if (active) setPaymentMethods(response.data)
            })
            .catch((requestError: unknown) => {
                if (!isRequestCanceled(requestError)) {
                    console.error('[CASHIER_PAYMENT_METHODS_ERROR]', requestError)
                    if (active) setPaymentMethods(['CASH', 'QRCODE'])
                }
            })
            .finally(() => {
                if (active) setLoadingMethods(false)
            })

        return () => {
            active = false
            controller.abort()
        }
    }, [])

    async function handleCloseModal() {
        try {
            await cashierApi.unlockOrder(orderId)
        } catch (requestError: unknown) {
            if (!isRequestCanceled(requestError)) {
                console.error('[CASHIER_UNLOCK_ORDER_ERROR]', requestError)
            }
        } finally {
            onClose()
        }
    }

    async function handleConfirmCash() {
        if (amountReceived < finalAmount) {
            alert('Tiền khách đưa chưa đủ!')
            return
        }

        setProcessing(true)

        try {
            const request = {
                paymentMethod: 'CASH' as PaymentMethodType,
                amountPaid: amountReceived,
                customerId: customer?.id ?? null,
                pointsUsed,
            }

            const response = await cashierApi.completeCashPayment(orderId, request)

            if (response?.data?.success) {
                onSuccess(response.data)
                return
            }

            alert(response?.data?.message ?? 'Có lỗi xảy ra từ server!')
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[CASHIER_CASH_PAYMENT_ERROR]', requestError)

            alert('Lỗi thanh toán: Kiểm tra lại mạng hoặc đơn hàng!')
        } finally {
            setProcessing(false)
        }
    }

    async function handleRedirectToVNPay() {
        setProcessing(true)

        try {
            const response = await cashierApi.getVNPayQrCode(
                orderId,
                customer?.id,
                pointsUsed,
            )

            if (response?.data?.success && response.data.paymentUrl) {
                window.location.href = response.data.paymentUrl

                return
            }

            alert(response?.data?.message ?? 'Không thể khởi tạo cổng VNPay.')

            setProcessing(false)
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[CASHIER_VNPAY_CREATE_ERROR]', requestError)

            alert('Lỗi tạo cổng VNPay! Kiểm tra lại mạng hoặc tải lại trang.')

            setMethod(null)
            setProcessing(false)
        }
    }

    return (
        <div className="modal-backdrop" style={backdropStyle}>
            <div className="modal-card" style={modalCardStyle}>
                <div className="modal-header" style={modalHeaderStyle}>
                    <h2
                        style={{
                            margin: 0,
                        }}
                    >
                        Thanh Toán
                    </h2>

                    <button
                        type="button"
                        style={closeButtonStyle}
                        onClick={() => void handleCloseModal()}
                    >
                        ×
                    </button>
                </div>

                <div
                    className="modal-body"
                    style={{
                        marginTop: '1.5rem',
                    }}
                >
                    {customer && (
                        <div style={customerSummaryStyle}>
                            👤 Khách: <strong>{customer.fullName}</strong>
                            {pointsUsed > 0 && (
                                <span
                                    style={{
                                        color: '#059669',
                                    }}
                                >
                                    {' '}
                                    — Đã dùng {pointsUsed} điểm giảm giá
                                </span>
                            )}
                        </div>
                    )}

                    <div style={amountSummaryStyle}>
                        <span>Cần thu:</span>
                        <strong
                            style={{
                                color: '#b91c1c',
                            }}
                        >
                            {formatCurrency(finalAmount)}
                        </strong>
                    </div>

                    {method === null &&
                        (loadingMethods ? (
                            <p style={{textAlign: 'center', color: '#64748b'}}>
                                Đang tải phương thức thanh toán...
                            </p>
                        ) : (
                            <div style={methodGridStyle}>
                                {paymentMethods.map((m) => {
                                    const {icon, label} = methodDisplay(m)
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            className="secondary-button"
                                            style={methodButtonStyle}
                                            onClick={() =>
                                                setMethod(m as PaymentMethodType)
                                            }
                                        >
                                            {icon} {label}
                                        </button>
                                    )
                                })}
                            </div>
                        ))}

                    {method === 'CASH' && (
                        <div style={cashFormStyle}>
                            <label style={fieldLabelStyle}>
                                Khách đưa (VND):
                                <input
                                    type="number"
                                    min={0}
                                    style={numberInputStyle}
                                    value={amountReceived || ''}
                                    onChange={(event) =>
                                        setAmountReceived(
                                            Math.max(0, Number(event.target.value)),
                                        )
                                    }
                                />
                            </label>

                            <div style={changeBoxStyle}>
                                <span
                                    style={{
                                        color: '#475569',
                                    }}
                                >
                                    Tiền thừa trả khách:{' '}
                                </span>

                                <strong style={changeAmountStyle}>
                                    {formatCurrency(changeReturned)}
                                </strong>
                            </div>

                            <div style={actionRowStyle}>
                                <button
                                    type="button"
                                    className="secondary-button"
                                    style={{
                                        flex: 1,
                                    }}
                                    disabled={processing}
                                    onClick={() => setMethod(null)}
                                >
                                    Quay lại
                                </button>

                                <button
                                    type="button"
                                    style={confirmCashButtonStyle}
                                    disabled={amountReceived < finalAmount || processing}
                                    onClick={() => void handleConfirmCash()}
                                >
                                    {processing
                                        ? 'Đang xử lý...'
                                        : 'Xác nhận & In Hóa Đơn'}
                                </button>
                            </div>
                        </div>
                    )}

                    {method === 'QRCODE' && (
                        <div
                            style={{
                                textAlign: 'center',
                            }}
                        >
                            <div style={vnpayBoxStyle}>
                                <div style={vnpayIconStyle}>🌐</div>

                                <h3 style={vnpayTitleStyle}>Cổng thanh toán VNPay</h3>

                                <p style={vnpayDescriptionStyle}>
                                    Hệ thống sẽ chuyển hướng sang VNPay để nhập thông tin
                                    thẻ. Hóa đơn sẽ được in sau khi thanh toán thành công.
                                </p>
                            </div>

                            <div style={actionRowStyle}>
                                <button
                                    type="button"
                                    className="secondary-button"
                                    style={{
                                        flex: 1,
                                    }}
                                    disabled={processing}
                                    onClick={() => setMethod(null)}
                                >
                                    Hủy bỏ
                                </button>

                                <button
                                    type="button"
                                    style={vnpayButtonStyle}
                                    disabled={processing}
                                    onClick={() => void handleRedirectToVNPay()}
                                >
                                    {processing ? 'Đang kết nối...' : 'Chuyển hướng ngay'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const backdropStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
}

const modalCardStyle: CSSProperties = {
    background: '#fff',
    padding: '2rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '480px',
}

const modalHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '0.5rem',
}

const closeButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
}

const customerSummaryStyle: CSSProperties = {
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '8px',
    padding: '10px',
    marginBottom: '1rem',
    fontSize: '0.9rem',
}

const amountSummaryStyle: CSSProperties = {
    fontSize: '1.1rem',
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
}

const methodGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
}

const methodButtonStyle: CSSProperties = {
    height: '70px',
    fontSize: '1.05rem',
    cursor: 'pointer',
}

const cashFormStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
}

const fieldLabelStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
}

const numberInputStyle: CSSProperties = {
    padding: '0.6rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
}

const changeBoxStyle: CSSProperties = {
    padding: '0.85rem',
    background: '#f8fafc',
    borderRadius: '8px',
}

const changeAmountStyle: CSSProperties = {
    fontSize: '1.15rem',
    color: '#16a34a',
}

const actionRowStyle: CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
}

const confirmCashButtonStyle: CSSProperties = {
    flex: 2,
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
}

const vnpayBoxStyle: CSSProperties = {
    background: '#f8fafc',
    padding: '2rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    marginBottom: '1rem',
}

const vnpayIconStyle: CSSProperties = {
    fontSize: '3rem',
    marginBottom: '1rem',
}

const vnpayTitleStyle: CSSProperties = {
    margin: '0 0 10px 0',
    color: '#1e293b',
}

const vnpayDescriptionStyle: CSSProperties = {
    fontSize: '0.9rem',
    color: '#64748b',
}

const vnpayButtonStyle: CSSProperties = {
    flex: 2,
    background: '#005baa',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
}
