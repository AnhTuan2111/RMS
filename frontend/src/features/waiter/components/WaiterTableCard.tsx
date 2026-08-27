import type {TableDetailResponse} from '@/shared/api/waiter'

type WaiterTableStatus = 'AVAILABLE' | 'SERVING' | 'RESERVED'

interface WaiterTableCardProps {
    table: TableDetailResponse
    status: WaiterTableStatus
    statusLabel: string
    nextReservationTime?: string
    hasStatusNotification?: boolean
    onClick: (table: TableDetailResponse) => void
}

export function WaiterTableCard({
    table,
    status,
    statusLabel,
    nextReservationTime,
    hasStatusNotification = false,
    onClick,
}: WaiterTableCardProps) {
    const isAvailableButReserved =
        status === 'AVAILABLE' && Boolean(table.upcomingReservationTime)

    const cardClass = [
        'waiter-table-card',
        `waiter-table-${status.toLowerCase()}`,
        isAvailableButReserved ? 'has-warning' : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <button onClick={() => onClick(table)} className={cardClass}>
            {hasStatusNotification && (
                <span
                    className="waiter-table-notification-dot"
                    aria-label="Có cập nhật món"
                />
            )}

            <strong className="waiter-table-number">
                Bàn {table.tableNumber} - {table.capacity} chỗ
            </strong>

            <div className="waiter-table-footer">
                <small className="waiter-table-status">{statusLabel}</small>
                {status === 'RESERVED' && nextReservationTime && (
                    <span className="waiter-table-res-time">{nextReservationTime}</span>
                )}
                {isAvailableButReserved && table.upcomingReservationTime && (
                    <span className="waiter-table-warning-badge">
                        Đã đặt lúc{' '}
                        {table.upcomingReservationTime.split('T')[1].substring(0, 5)}
                    </span>
                )}
            </div>
        </button>
    )
}
