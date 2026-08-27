import {useCallback, useEffect, useState, type CSSProperties} from 'react'
import {useNavigate, useParams} from 'react-router-dom'

import {type OrderDetailResponse, waiterApi} from '@/shared/api/waiter'
import {BackArrow, fmtPrice, WaiterHeader} from './components'
import {useWaiterSocket} from '@/realtime'

function isRequestCanceled(error: unknown) {
    if (typeof error !== 'object' || error === null) {
        return false
    }

    const requestError = error as {
        name?: string
        code?: string
        message?: string
    }

    return (
        requestError.name === 'CanceledError' ||
        requestError.code === 'ERR_CANCELED' ||
        requestError.message === 'canceled'
    )
}

export default function WaiterOrderDetailPage() {
    const navigate = useNavigate()
    const {tableId} = useParams()

    const tableIdNumber = Number.parseInt(tableId ?? '0', 10)

    const [servingOrders, setServingOrders] = useState<OrderDetailResponse[]>([])

    const [isLoading, setIsLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const loadServingOrders = useCallback(
        async (signal?: AbortSignal, showFullLoading = true) => {
            if (!tableIdNumber) {
                setServingOrders([])
                setError('Không xác định được bàn.')
                setIsLoading(false)
                return
            }

            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                setError(null)

                const response = await waiterApi.getServingOrders(tableIdNumber, signal)

                if (signal?.aborted) {
                    return
                }

                setServingOrders(response.data)

                // Đánh dấu đã xem các ghi chú nội bộ của chef chưa được ack.
                // orderItemId là optional trong response, lọc bỏ trước khi gọi API.
                const unacknowledgedItemIds = response.data
                    .flatMap((order) => order.orderItems)
                    .filter(
                        (item) =>
                            item.chefInternalNote && !item.chefInternalNoteAcknowledgedAt,
                    )
                    .map((item) => item.orderItemId)
                    .filter((itemId): itemId is number => itemId != null)

                if (unacknowledgedItemIds.length > 0 && !signal?.aborted) {
                    await Promise.all(
                        unacknowledgedItemIds.map((itemId) =>
                            waiterApi
                                .acknowledgeChefInternalNote(itemId)
                                .catch((requestError) => {
                                    console.error(
                                        '[WAITER_ACK_CHEF_NOTE_ERROR]',
                                        requestError,
                                    )
                                }),
                        ),
                    )
                }
            } catch (requestError: unknown) {
                if (signal?.aborted || isRequestCanceled(requestError)) {
                    return
                }

                console.error('[WAITER_ORDER_DETAIL_FETCH_ERROR]', requestError)

                setError('Không thể tải chi tiết đơn hàng của bàn.')
            } finally {
                if (showFullLoading && !signal?.aborted) {
                    setIsLoading(false)
                }
            }
        },
        [tableIdNumber],
    )

    // Initial load on mount
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadServingOrders()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadServingOrders])

    // WebSocket: refresh when backend broadcasts waiter or table updates
    useWaiterSocket(
        () => void loadServingOrders(undefined, false),
        () => void loadServingOrders(undefined, false),
    )

    const orderItems = servingOrders.flatMap((order) => order.orderItems)

    return (
        <div className="waiter-container">
            <WaiterHeader />

            <main className="waiter-main">
                <div className="waiter-sub-header">
                    <BackArrow onClick={() => navigate('/waiter/tables')} />

                    <h2 className="waiter-title">Bàn: {tableIdNumber || '—'}</h2>

                    <button
                        type="button"
                        className="waiter-action-btn"
                        disabled={!tableIdNumber}
                        onClick={() =>
                            navigate(`/waiter/tables/${tableIdNumber}/order/edit`)
                        }
                    >
                        Cập nhật đơn hàng
                    </button>
                </div>

                <div className="waiter-detail-layout">
                    <div className="waiter-card">
                        <div className="waiter-card-header">Danh sách món</div>

                        <div
                            className="waiter-card-body"
                            style={{
                                padding: 0,
                            }}
                        >
                            {isLoading ? (
                                <div style={stateBoxStyle}>
                                    Đang tải chi tiết đơn hàng...
                                </div>
                            ) : error ? (
                                <div style={errorBoxStyle}>
                                    <p>{error}</p>

                                    <button
                                        type="button"
                                        className="waiter-action-btn"
                                        onClick={() =>
                                            void loadServingOrders(undefined, true)
                                        }
                                    >
                                        Thử lại
                                    </button>
                                </div>
                            ) : orderItems.length === 0 ? (
                                <div style={stateBoxStyle}>
                                    Bàn này chưa có món đang phục vụ.
                                </div>
                            ) : (
                                <table className="waiter-table-custom">
                                    <thead>
                                        <tr>
                                            <th>Món</th>
                                            <th>SL</th>
                                            <th>Đơn giá</th>
                                            <th>Trạng thái</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {orderItems.map((item) => (
                                            <tr key={item.orderItemId}>
                                                <td>
                                                    {item.dishName}

                                                    {item.note && (
                                                        <div style={noteStyle}>
                                                            {item.note}
                                                        </div>
                                                    )}

                                                    {item.status === 'CANCELLED' &&
                                                        item.cancelReason && (
                                                            <div
                                                                style={cancelReasonStyle}
                                                            >
                                                                Lý do hủy:{' '}
                                                                {item.cancelReason}
                                                            </div>
                                                        )}

                                                    {item.chefInternalNote && (
                                                        <div style={chefNoteStyle}>
                                                            Chef: {item.chefInternalNote}
                                                        </div>
                                                    )}
                                                </td>

                                                <td>{item.quantity}</td>

                                                <td>{fmtPrice(item.unitPrice)}</td>

                                                <td>
                                                    <span
                                                        className={`waiter-badge waiter-badge-${(item.status ?? '').toLowerCase()}`}
                                                    >
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

const stateBoxStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#64748b',
}

const errorBoxStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#dc2626',
}

const noteStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#64748b',
    marginTop: '0.25rem',
}

const chefNoteStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#ea580c',
    marginTop: '0.25rem',
    fontWeight: 600,
}

const cancelReasonStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#dc2626',
    marginTop: '0.25rem',
    fontWeight: 600,
}
