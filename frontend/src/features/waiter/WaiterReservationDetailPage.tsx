import {useRef, useState, type CSSProperties} from 'react'
import {useNavigate, useParams} from 'react-router-dom'

import * as waiterApi from '@/shared/api/waiter'
import type {ReservationResponse} from '@/shared/api/waiter'
import {REALTIME_CONFIG} from '@/app/config/realtime'
import {BackArrow, WaiterHeader} from './components'
import {usePolling} from '@/shared/hooks/usePolling'
import {isRequestCanceled} from '@/shared/utils/error'

function getReservationId(reservation: ReservationResponse) {
    return reservation.reservationId ?? reservation.id
}

function splitReservationTime(value?: string | null) {
    if (!value) {
        return {
            date: '',
            time: '',
        }
    }

    const [date, rawTime = ''] = value.split('T')

    return {
        date,
        time: rawTime.substring(0, 5),
    }
}

export default function WaiterReservationDetailPage() {
    const navigate = useNavigate()
    const {tableId} = useParams()

    const tableIdNumber = Number.parseInt(tableId ?? '0', 10)

    const [reservation, setReservation] = useState<ReservationResponse | null>(null)

    const [isLoading, setIsLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const hasLoadedInitialReservationRef = useRef(false)

    async function loadReservation(signal?: AbortSignal, showFullLoading = true) {
        if (!tableIdNumber) {
            setReservation(null)
            setError('Không xác định được bàn.')
            setIsLoading(false)
            return
        }

        try {
            if (showFullLoading) {
                setIsLoading(true)
            }

            setError(null)

            const response = await waiterApi.getCurrentReservationByTable(
                tableIdNumber,
                signal,
            )

            if (signal?.aborted) {
                return
            }

            setReservation(response.data ?? null)
        } catch (requestError: unknown) {
            if (signal?.aborted || isRequestCanceled(requestError)) {
                return
            }

            console.error('[WAITER_RESERVATION_DETAIL_FETCH_ERROR]', requestError)

            setError('Không thể tải thông tin đặt bàn.')
        } finally {
            if (showFullLoading && !signal?.aborted) {
                setIsLoading(false)
            }
        }
    }

    usePolling(
        async (signal) => {
            const isInitialLoad = !hasLoadedInitialReservationRef.current

            await loadReservation(signal, isInitialLoad)

            hasLoadedInitialReservationRef.current = true
        },
        {
            intervalMs: REALTIME_CONFIG.waiter.orderDetailIntervalMs,

            runImmediately: true,
            pauseWhenHidden: true,

            onError: (requestError) => {
                console.error('[WAITER_RESERVATION_DETAIL_POLL_ERROR]', requestError)
            },
        },
    )

    const {date, time} = splitReservationTime(reservation?.reservationTime)

    const reservationId = reservation ? getReservationId(reservation) : undefined

    if (isLoading) {
        return (
            <div className="waiter-container">
                <WaiterHeader />

                <main className="waiter-main">
                    <p style={stateTextStyle}>Đang tải thông tin đặt bàn...</p>
                </main>
            </div>
        )
    }

    if (error) {
        return (
            <div className="waiter-container">
                <WaiterHeader />

                <main className="waiter-main">
                    <div className="waiter-sub-header">
                        <BackArrow onClick={() => navigate('/waiter/tables')} />

                        <h2 className="waiter-title">Chi tiết đặt bàn</h2>
                    </div>

                    <div className="waiter-card" style={cardStyle}>
                        <div className="waiter-card-body">
                            <p style={errorTextStyle}>{error}</p>

                            <button
                                type="button"
                                className="waiter-btn-primary"
                                style={buttonTopStyle}
                                onClick={() => void loadReservation(undefined, true)}
                            >
                                Thử lại
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    if (!reservation) {
        return (
            <div className="waiter-container">
                <WaiterHeader />

                <main className="waiter-main">
                    <div className="waiter-sub-header">
                        <BackArrow onClick={() => navigate('/waiter/tables')} />

                        <h2 className="waiter-title">Chi tiết đặt bàn</h2>
                    </div>

                    <div className="waiter-card" style={cardStyle}>
                        <div className="waiter-card-body">
                            <p style={stateTextStyle}>
                                Không có đặt bàn đang hoạt động cho bàn này. Bàn có thể đã
                                hết thời gian chờ hoặc đã được phục vụ.
                            </p>

                            <button
                                type="button"
                                className="waiter-btn-primary"
                                style={buttonTopStyle}
                                onClick={() => navigate('/waiter/tables')}
                            >
                                Về danh sách bàn
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="waiter-container">
            <WaiterHeader />

            <main className="waiter-main">
                <div className="waiter-sub-header">
                    <BackArrow onClick={() => navigate('/waiter/tables')} />

                    <h2 className="waiter-title">
                        Chi tiết đặt bàn — Bàn {tableIdNumber}
                    </h2>

                    <button
                        type="button"
                        className="waiter-action-btn"
                        disabled={!reservationId}
                        onClick={() =>
                            navigate(
                                `/waiter/tables/${tableIdNumber}/order/new?reservationId=${reservationId}`,
                            )
                        }
                    >
                        Bắt đầu Order
                    </button>
                </div>

                <div className="waiter-card" style={cardStyle}>
                    <div className="waiter-card-header">Thông tin đặt bàn</div>

                    <div className="waiter-card-body">
                        <div className="waiter-detail-row">
                            <span>Mã đặt bàn</span>
                            <strong>{reservationId ?? '—'}</strong>
                        </div>

                        <div className="waiter-detail-row">
                            <span>Thời gian</span>
                            <strong>
                                {date} — {time}
                            </strong>
                        </div>

                        <div className="waiter-detail-row">
                            <span>Khách hàng</span>
                            <strong>{reservation.customerName}</strong>
                        </div>

                        <div className="waiter-detail-row">
                            <span>Số điện thoại</span>
                            <strong>{reservation.phone}</strong>
                        </div>

                        {reservation.note && (
                            <div className="waiter-detail-row">
                                <span>Ghi chú</span>
                                <strong>{reservation.note}</strong>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

const cardStyle: CSSProperties = {
    maxWidth: '600px',
}

const stateTextStyle: CSSProperties = {
    color: '#64748b',
}

const errorTextStyle: CSSProperties = {
    color: '#dc2626',
}

const buttonTopStyle: CSSProperties = {
    marginTop: '1rem',
}
