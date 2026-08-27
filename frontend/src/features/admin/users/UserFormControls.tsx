import {ghostBtn} from './styles'
import {useState} from 'react'
import type {ReactNode} from 'react'
export function Modal({
    title,
    onClose,
    children,
}: {
    title: string
    onClose: () => void
    children: ReactNode
}) {
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    background: '#fff',
                    borderRadius: 14,
                    padding: 28,
                    width: 500,
                    maxWidth: '92vw',
                    maxHeight: '82vh',
                    overflowY: 'auto',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 20,
                    }}
                >
                    <h3 style={{margin: 0, fontSize: 18, fontWeight: 700}}>{title}</h3>
                    <button
                        onClick={onClose}
                        style={{...ghostBtn, fontSize: 22, color: '#9ca3af'}}
                    >
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

export function FieldGroup({children}: {children: ReactNode}) {
    return (
        <div
            style={{display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16}}
        >
            {children}
        </div>
    )
}

export function Field({label, children}: {label: string; children: ReactNode}) {
    return (
        <label
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 14,
                fontWeight: 500,
                color: '#374151',
            }}
        >
            {label}
            {children}
        </label>
    )
}

export function DR({
    label,
    value,
    color,
}: {
    label: string
    value: string
    color?: string
}) {
    return (
        <div
            style={{
                display: 'flex',
                padding: '10px 0',
                borderBottom: '1px solid #f3f4f6',
                gap: 16,
            }}
        >
            <span style={{width: 140, color: '#9ca3af', fontSize: 13, flexShrink: 0}}>
                {label}
            </span>
            <span style={{fontWeight: 500, fontSize: 14, color: color ?? '#111827'}}>
                {value}
            </span>
        </div>
    )
}

export function ModalActions({children}: {children: ReactNode}) {
    return (
        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22}}>
            {children}
        </div>
    )
}

export function ErrBox({msg}: {msg: string}) {
    return (
        <div className="auth-error" style={{margin: '0 0 4px'}}>
            {msg}
        </div>
    )
}

export function PasswordInput({
    value,
    onChange,
    placeholder,
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
}) {
    const [visible, setVisible] = useState(false)
    return (
        <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
            <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 40px 9px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                }}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={{
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
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#4f46e5'
                    e.currentTarget.style.backgroundColor = '#eef2ff'
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af'
                    e.currentTarget.style.backgroundColor = 'transparent'
                }}
            >
                {visible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
        </div>
    )
}

export function EyeIcon() {
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

export function EyeOffIcon() {
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
