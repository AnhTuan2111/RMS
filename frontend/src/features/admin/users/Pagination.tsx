import type {CSSProperties} from 'react'
export function Pagination({
    page,
    totalPages,
    pageSize,
    totalItems,
    startIdx,
    endIdx,
    onPageChange,
    onPageSizeChange,
}: {
    page: number
    totalPages: number
    pageSize: number
    totalItems: number
    startIdx: number
    endIdx: number
    onPageChange: (p: number) => void
    onPageSizeChange: (size: number) => void
}) {
    // tính danh sách số trang hiển thị, dạng: 1 ... 4 5 [6] 7 8 ... 20
    const getPageNumbers = (): (number | '...')[] => {
        const delta = 1
        const range: (number | '...')[] = []
        const left = Math.max(2, page - delta)
        const right = Math.min(totalPages - 1, page + delta)

        range.push(1)
        if (left > 2) range.push('...')
        for (let i = left; i <= right; i++) range.push(i)
        if (right < totalPages - 1) range.push('...')
        if (totalPages > 1) range.push(totalPages)

        return range
    }

    const pageBtnStyle = (active: boolean, disabled?: boolean): CSSProperties => ({
        minWidth: 30,
        height: 30,
        padding: '0 6px',
        borderRadius: 6,
        border: '1px solid ' + (active ? '#4f46e5' : '#d1d5db'),
        background: active ? '#4f46e5' : '#fff',
        color: disabled ? '#d1d5db' : active ? '#fff' : '#374151',
        fontWeight: active ? 700 : 500,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
    })

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid #f3f4f6',
            }}
        >
            <div
                style={{
                    fontSize: 13,
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                }}
            >
                <span>
                    Hiển thị <strong>{startIdx}</strong>–<strong>{endIdx}</strong> trong
                    tổng số <strong>{totalItems}</strong>
                </span>
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    style={{
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontSize: 13,
                        background: '#fff',
                        cursor: 'pointer',
                    }}
                >
                    {[5, 10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                            {n} / trang
                        </option>
                    ))}
                </select>
            </div>

            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    style={pageBtnStyle(false, page <= 1)}
                    title="Trang trước"
                >
                    ‹
                </button>

                {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                        <span
                            key={`dots-${i}`}
                            style={{padding: '0 4px', color: '#9ca3af', fontSize: 13}}
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            style={pageBtnStyle(p === page)}
                        >
                            {p}
                        </button>
                    ),
                )}

                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    style={pageBtnStyle(false, page >= totalPages)}
                    title="Trang sau"
                >
                    ›
                </button>
            </div>
        </div>
    )
}
