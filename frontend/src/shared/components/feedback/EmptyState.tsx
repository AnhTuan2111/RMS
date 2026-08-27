import type {ReactNode} from 'react'

type EmptyStateProps = {
    title?: string
    description?: string
    action?: ReactNode
    icon?: ReactNode
}

export function EmptyState({
    title = 'Chưa có dữ liệu',
    description = 'Khi có dữ liệu mới, thông tin sẽ được hiển thị tại đây.',
    action,
    icon = '∅',
}: EmptyStateProps) {
    return (
        <div className="rims-feedback-state rims-feedback-empty">
            <div className="rims-feedback-icon empty">{icon}</div>

            <div>
                <h3>{title}</h3>

                {description && <p>{description}</p>}

                {action && <div className="mt-3">{action}</div>}
            </div>
        </div>
    )
}
