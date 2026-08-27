import type {HTMLAttributes, ReactNode} from 'react'

type PageCardProps = HTMLAttributes<HTMLElement> & {
    children: ReactNode
    variant?: 'default' | 'soft' | 'flush'
}

export function PageCard({
    children,
    className,
    variant = 'default',
    ...props
}: PageCardProps) {
    const variantClass =
        variant === 'soft'
            ? 'rims-page-card-soft'
            : variant === 'flush'
              ? 'rims-page-card-flush'
              : 'rims-page-card-default'

    return (
        <section
            className={[
                'page-card',
                'card',
                'border-0',
                'rims-page-card',
                variantClass,
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            {...props}
        >
            {children}
        </section>
    )
}
