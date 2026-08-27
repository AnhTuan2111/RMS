import type {ReactNode} from 'react'

type PageHeaderProps = {
    title: ReactNode
    description?: ReactNode
    eyebrow?: ReactNode
    actions?: ReactNode
    icon?: ReactNode
    className?: string
}

export function PageHeader({
    title,
    description,
    eyebrow,
    actions,
    icon,
    className,
}: PageHeaderProps) {
    return (
        <header
            className={[
                'page-header',
                'rims-page-header',
                'd-flex',
                'align-items-start',
                'justify-content-between',
                'gap-3',
                'flex-wrap',
                className,
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <div className="d-flex align-items-start gap-3 min-w-0">
                {icon && <div className="rims-page-header-icon">{icon}</div>}

                <div className="min-w-0">
                    {eyebrow && <div className="rims-page-eyebrow">{eyebrow}</div>}

                    <h2 className="rims-page-title mb-1">{title}</h2>

                    {description && (
                        <p className="rims-page-description mb-0">{description}</p>
                    )}
                </div>
            </div>

            {actions && (
                <div className="rims-page-actions d-flex align-items-center gap-2 flex-wrap">
                    {actions}
                </div>
            )}
        </header>
    )
}
