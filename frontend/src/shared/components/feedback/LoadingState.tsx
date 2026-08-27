type LoadingStateProps = {
    title?: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
}

export function LoadingState({
    title = 'Đang tải dữ liệu...',
    description = 'Hệ thống đang đồng bộ thông tin mới nhất.',
    size = 'md',
}: LoadingStateProps) {
    return (
        <div className={`rims-feedback-state rims-feedback-loading state-${size}`}>
            <div className="rims-feedback-orb">
                <div
                    className="spinner-border text-primary"
                    role="status"
                    aria-label={title}
                />
            </div>

            <div>
                <h3>{title}</h3>
                {description && <p>{description}</p>}
            </div>
        </div>
    )
}
