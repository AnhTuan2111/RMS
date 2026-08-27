import type {ReactNode} from 'react'

export function ConfirmModal({
    title,
    message,
    confirmLabel = 'Xác nhận',
    cancelLabel = 'Hủy',
    onConfirm,
    onCancel,
    children,
}: {
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void
    onCancel: () => void
    children?: ReactNode
}) {
    return (
        <div className="waiter-modal-overlay" onClick={onCancel}>
            <div className="waiter-modal" onClick={(e) => e.stopPropagation()}>
                <h3>{title}</h3>
                {message && <p>{message}</p>}
                {children}
                <div className="waiter-modal-actions">
                    {cancelLabel && (
                        <button onClick={onCancel} className="waiter-btn-outline">
                            {cancelLabel}
                        </button>
                    )}
                    <button onClick={onConfirm} className="waiter-btn-primary">
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
