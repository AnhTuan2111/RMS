import {type CSSProperties} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'

import {cashierApi} from '@/shared/api/cashier'

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
        requestError.name === 'CanceledError' ||
        requestError.code === 'ERR_CANCELED' ||
        requestError.message === 'canceled'
    )
}

export default function PaymentSuccess() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const invoiceId = searchParams.get('invoiceId')

    async function handleDownloadPdf() {
        if (!invoiceId) {
            return
        }

        try {
            const response = await cashierApi.downloadInvoicePdf(Number(invoiceId))

            const blob = new Blob([response.data as BlobPart], {
                type: 'application/pdf',
            })

            const url = window.URL.createObjectURL(blob)

            const link = document.createElement('a')

            link.href = url
            link.setAttribute('download', `Invoice-${invoiceId}.pdf`)

            document.body.appendChild(link)
            link.click()
            link.remove()

            window.URL.revokeObjectURL(url)
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[PAYMENT_SUCCESS_DOWNLOAD_PDF_ERROR]', requestError)

            alert('Không thể tải PDF! Vui lòng thử lại.')
        }
    }

    return (
        <div style={pageStyle}>
            <div className="page-card" style={cardStyle}>
                <div style={iconStyle}>✔</div>

                <h1 style={titleStyle}>Thanh Toán Thành Công!</h1>

                <p style={descriptionStyle}>
                    Giao dịch qua VNPay đã hoàn tất. Hóa đơn của quý khách đã được lưu lại
                    hệ thống.
                </p>

                {invoiceId && (
                    <div style={invoiceBoxStyle}>
                        <strong>Mã hóa đơn: INV-{invoiceId}</strong>
                    </div>
                )}

                <div style={actionRowStyle}>
                    <button
                        type="button"
                        style={downloadButtonStyle}
                        disabled={!invoiceId}
                        onClick={() => void handleDownloadPdf()}
                    >
                        📥 Tải PDF Hóa Đơn
                    </button>

                    <button
                        type="button"
                        style={backButtonStyle}
                        onClick={() => navigate('/cashier/payments')}
                    >
                        Về màn hình Thu Ngân
                    </button>
                </div>
            </div>
        </div>
    )
}

const pageStyle: CSSProperties = {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0fdf4',
}

const cardStyle: CSSProperties = {
    textAlign: 'center',
    padding: '3rem',
    maxWidth: '500px',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
}

const iconStyle: CSSProperties = {
    fontSize: '5rem',
    color: '#16a34a',
    marginBottom: '1rem',
}

const titleStyle: CSSProperties = {
    color: '#16a34a',
    marginBottom: '1rem',
}

const descriptionStyle: CSSProperties = {
    color: '#475569',
    marginBottom: '2rem',
}

const invoiceBoxStyle: CSSProperties = {
    background: '#e2e8f0',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '2rem',
}

const actionRowStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
}

const downloadButtonStyle: CSSProperties = {
    padding: '0.8rem 1.5rem',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
}

const backButtonStyle: CSSProperties = {
    padding: '0.8rem 1.5rem',
    background: '#cbd5e1',
    color: '#1e293b',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
}
