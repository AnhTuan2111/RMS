import {type CSSProperties} from 'react'
import {useNavigate} from 'react-router-dom'

export default function PaymentFailed() {
    const navigate = useNavigate()

    return (
        <div style={pageStyle}>
            <div className="page-card" style={cardStyle}>
                <div style={iconStyle}>✖</div>

                <h1 style={titleStyle}>Giao Dịch Thất Bại</h1>

                <p style={descriptionStyle}>
                    Khách hàng đã hủy giao dịch hoặc có lỗi xảy ra từ ngân hàng.
                </p>

                <button
                    type="button"
                    style={backButtonStyle}
                    onClick={() => navigate('/cashier/payments')}
                >
                    Quay lại màn hình Thu Ngân
                </button>
            </div>
        </div>
    )
}

const pageStyle: CSSProperties = {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fef2f2',
}

const cardStyle: CSSProperties = {
    textAlign: 'center',
    padding: '3rem',
    maxWidth: '500px',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
}

const iconStyle: CSSProperties = {
    fontSize: '5rem',
    color: '#dc2626',
    marginBottom: '1rem',
}

const titleStyle: CSSProperties = {
    color: '#dc2626',
    marginBottom: '1rem',
}

const descriptionStyle: CSSProperties = {
    color: '#475569',
    marginBottom: '2rem',
}

const backButtonStyle: CSSProperties = {
    padding: '0.8rem 1.5rem',
    background: '#64748b',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
}
