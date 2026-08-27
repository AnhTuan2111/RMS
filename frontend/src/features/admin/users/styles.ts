import type {CSSProperties} from 'react'
export const gridCols: CSSProperties = {
    gridTemplateColumns: '40px 1.5fr 1fr 1.5fr 1fr 1fr 1fr 1fr',
}

export const ghostBtn: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
}

export function btn(bg: string, color: string): CSSProperties {
    return {
        background: bg,
        color,
        border: 'none',
        padding: '4px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
    }
}
