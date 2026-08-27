export function StatIcon({children, className}: {children: string; className: string}) {
    return (
        <span className={`rims-stat-card-icon-wrapper ${className}`}>
            <span>{children}</span>
        </span>
    )
}

export function DongIcon() {
    return (
        <span aria-hidden="true" className="admin-revenue-card-icon">
            ₫
        </span>
    )
}

export function CalendarIcon() {
    return (
        <svg
            aria-hidden="true"
            className="admin-revenue-calendar-icon"
            viewBox="0 0 24 24"
        >
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <path d="M3 10h18" />
            <path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        </svg>
    )
}

export function FileIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
            <path d="M14 2v5h5" />
            <path d="M9 13h6" />
            <path d="M9 17h6" />
        </svg>
    )
}

export function TrophyIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
            <path d="M7 6H4a2 2 0 0 0 2 4h1" />
            <path d="M17 6h3a2 2 0 0 1-2 4h-1" />
        </svg>
    )
}

export function CrownIcon() {
    return (
        <svg aria-hidden="true" className="bestseller-rank-crown" viewBox="0 0 24 24">
            <path d="m3 8 4 3 5-7 5 7 4-3-2 10H5z" />
            <path d="M5 18h14" />
        </svg>
    )
}

export function TrendingIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 17 9 11l4 4 7-8" />
            <path d="M14 7h6v6" />
        </svg>
    )
}
