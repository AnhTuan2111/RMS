import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react'
import {useNavigate, useParams} from 'react-router-dom'

import {
    type CreateReservationRequest,
    type ReservationResponse,
    type TableDetailResponse,
    type TimeRangeResponse,
    waiterApi,
} from '@/shared/api/waiter'
import {getAvailableTimeSlots} from '@/shared/utils/reservationTime'
import {REALTIME_CONFIG} from '@/app/config/realtime'
import {WaiterHeader, WaiterToast} from './components'
import {usePolling} from '@/shared/hooks/usePolling'
import {getErrorMessage, isRequestCanceled} from '@/shared/utils/error'

type ToastState = {
    msg: string
    type: string
} | null

type ReservationForm = {
    customerName: string
    phone: string
    date: string
    time: string
    tableId: number
    note: string
}

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

export default function WaiterEditReservationPage() {
    const navigate = useNavigate()
    const {resId} = useParams()

    const reservationId = Number.parseInt(resId ?? '0', 10)

    const [tables, setTables] = useState<TableDetailResponse[]>([])

    const [toast, setToast] = useState<ToastState>(null)

    const [resFormError, setResFormError] = useState('')

    const [rightReservations, setRightReservations] = useState<ReservationResponse[]>([])

    const [blockedRanges, setBlockedRanges] = useState<TimeRangeResponse[]>([])

    const [resForm, setResForm] = useState<ReservationForm>({
        customerName: '',
        phone: '',
        date: '',
        time: '',
        tableId: 0,
        note: '',
    })

    const [isDetailLoading, setIsDetailLoading] = useState(true)

    const [isTablesLoading, setIsTablesLoading] = useState(true)

    const [isReservationsLoading, setIsReservationsLoading] = useState(false)

    const [submitting, setSubmitting] = useState(false)

    const [canceling, setCanceling] = useState(false)

    const hasLoadedDetailRef = useRef(false)

    const hasLoadedInitialTablesRef = useRef(false)

    const hasLoadedInitialReservationsRef = useRef(false)

    const availableTimeSlots = useMemo(
        () => getAvailableTimeSlots(resForm.date, blockedRanges),
        [resForm.date, blockedRanges],
    )

    // Tương tự trang tạo mới: tự chuyển sang slot khả dụng đầu tiên nếu
    // giờ đang chọn không còn hợp lệ (đã qua giờ hoặc bị chặn).
    useEffect(() => {
        if (availableTimeSlots.length === 0) {
            return
        }

        if (!availableTimeSlots.includes(resForm.time)) {
            queueMicrotask(() => {
                setResForm((previous) => ({
                    ...previous,
                    time: availableTimeSlots[0],
                }))
            })
        }
    }, [availableTimeSlots, resForm.time])

    function showToast(msg: string, type = 'success') {
        setToast({
            msg,
            type,
        })

        window.setTimeout(() => setToast(null), 3000)
    }

    async function loadTables(signal?: AbortSignal, showFullLoading = true) {
        try {
            if (showFullLoading) {
                setIsTablesLoading(true)
            }

            const response = await waiterApi.getTables(signal)

            if (signal?.aborted) {
                return
            }

            setTables(response.data)
        } catch (requestError: unknown) {
            if (signal?.aborted || isRequestCanceled(requestError)) {
                return
            }

            console.error('[WAITER_EDIT_RESERVATION_TABLES_ERROR]', requestError)

            setResFormError('Không thể tải danh sách bàn.')
        } finally {
            if (showFullLoading && !signal?.aborted) {
                setIsTablesLoading(false)
            }
        }
    }

    async function loadReservations(
        signal?: AbortSignal,
        showFullLoading = true,
        override?: Partial<Pick<ReservationForm, 'tableId' | 'date'>>,
    ) {
        const tableId = override?.tableId ?? resForm.tableId

        const date = override?.date ?? resForm.date

        if (!tableId || !date) {
            setRightReservations([])
            return
        }

        try {
            if (showFullLoading) {
                setIsReservationsLoading(true)
            }

            const response = await waiterApi.getReservationsByTableAndDate(
                tableId,
                date,
                signal,
            )

            if (signal?.aborted) {
                return
            }

            setRightReservations(response.data ?? [])
        } catch (requestError: unknown) {
            if (signal?.aborted || isRequestCanceled(requestError)) {
                return
            }

            console.error('[WAITER_EDIT_RESERVATION_LIST_ERROR]', requestError)

            setRightReservations([])
        } finally {
            if (showFullLoading && !signal?.aborted) {
                setIsReservationsLoading(false)
            }
        }
    }

    async function loadBlockedSlots(
        signal?: AbortSignal,
        override?: Partial<Pick<ReservationForm, 'tableId' | 'date'>>,
    ) {
        const tableId = override?.tableId ?? resForm.tableId

        const date = override?.date ?? resForm.date

        if (!tableId || !date) {
            setBlockedRanges([])
            return
        }

        try {
            const response = await waiterApi.getBlockedTimeSlots(
                tableId,
                date,
                reservationId,
                signal,
            )

            if (signal?.aborted) {
                return
            }

            setBlockedRanges(response.data ?? [])
        } catch (requestError: unknown) {
            if (signal?.aborted || isRequestCanceled(requestError)) {
                return
            }

            console.error('[WAITER_EDIT_BLOCKED_SLOTS_ERROR]', requestError)

            setBlockedRanges([])
        }
    }

    async function loadReservationDetail(signal?: AbortSignal) {
        if (!reservationId) {
            setResFormError('Không xác định được đặt bàn.')
            setIsDetailLoading(false)
            return
        }

        try {
            setIsDetailLoading(true)

            const response = await waiterApi.getReservationDetail(reservationId, signal)

            if (signal?.aborted) {
                return
            }

            const data = response.data

            if (!data) {
                setResFormError('Không tìm thấy đặt bàn.')
                return
            }

            const {date, time} = splitReservationTime(data.reservationTime)

            const nextForm: ReservationForm = {
                customerName: data.customerName,
                phone: data.phone,
                date,
                time,
                tableId: data.tableId,
                note: data.note ?? '',
            }

            setResForm(nextForm)

            await loadReservations(signal, true, {
                tableId: nextForm.tableId,
                date: nextForm.date,
            })

            await loadBlockedSlots(signal, {
                tableId: nextForm.tableId,
                date: nextForm.date,
            })
        } catch (requestError: unknown) {
            if (signal?.aborted || isRequestCanceled(requestError)) {
                return
            }

            console.error('[WAITER_EDIT_RESERVATION_DETAIL_ERROR]', requestError)

            setResFormError('Không thể tải thông tin đặt bàn.')

            window.setTimeout(() => navigate('/waiter/tables'), 800)
        } finally {
            if (!signal?.aborted) {
                setIsDetailLoading(false)
            }
        }
    }

    usePolling(
        async (signal) => {
            if (hasLoadedDetailRef.current) {
                return
            }

            await loadReservationDetail(signal)
            hasLoadedDetailRef.current = true
        },
        {
            intervalMs: REALTIME_CONFIG.waiter.orderDetailIntervalMs,

            runImmediately: true,
            pauseWhenHidden: true,

            onError: (requestError) => {
                console.error('[WAITER_EDIT_RESERVATION_DETAIL_POLL_ERROR]', requestError)
            },
        },
    )

    usePolling(
        async (signal) => {
            const isInitialLoad = !hasLoadedInitialTablesRef.current

            await loadTables(signal, isInitialLoad)

            hasLoadedInitialTablesRef.current = true
        },
        {
            intervalMs: REALTIME_CONFIG.waiter.tablesIntervalMs,

            runImmediately: true,
            pauseWhenHidden: true,

            onError: (requestError) => {
                console.error('[WAITER_EDIT_RESERVATION_TABLES_POLL_ERROR]', requestError)
            },
        },
    )

    usePolling(
        async (signal) => {
            const isInitialLoad = !hasLoadedInitialReservationsRef.current

            await loadReservations(signal, isInitialLoad)

            hasLoadedInitialReservationsRef.current = true
        },
        {
            intervalMs: REALTIME_CONFIG.waiter.tablesIntervalMs,

            runImmediately: true,
            pauseWhenHidden: true,

            onError: (requestError) => {
                console.error('[WAITER_EDIT_RESERVATION_LIST_POLL_ERROR]', requestError)
            },
        },
    )

    function updateForm(patch: Partial<ReservationForm>) {
        const nextForm = {
            ...resForm,
            ...patch,
        }

        setResForm(nextForm)

        if ('tableId' in patch || 'date' in patch) {
            void loadReservations(undefined, true, {
                tableId: nextForm.tableId,
                date: nextForm.date,
            })

            void loadBlockedSlots(undefined, {
                tableId: nextForm.tableId,
                date: nextForm.date,
            })
        }
    }

    async function submitReservation() {
        const {customerName, phone, date, time, tableId, note} = resForm

        if (!customerName.trim() || !phone.trim() || !date || !time || !tableId) {
            setResFormError('Vui lòng điền đầy đủ thông tin bắt buộc.')
            return
        }

        const timeHour = Number.parseInt(time.split(':')[0] ?? '0', 10)

        if (timeHour < 8 || timeHour > 20) {
            setResFormError('Giờ đặt bàn phải nằm trong khoảng từ 08:00 đến 20:00.')
            return
        }

        const reservationTime = `${date}T${time}:00`

        const payload: CreateReservationRequest = {
            customerName: customerName.trim(),
            phone: phone.trim(),
            tableId,
            reservationTime,
            note: note.trim() || undefined,
        }

        setSubmitting(true)

        try {
            await waiterApi.updateReservation(reservationId, payload)

            showToast('Đã lưu thay đổi đặt bàn')
            setResFormError('')

            window.setTimeout(() => navigate('/waiter/tables'), 800)
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[WAITER_EDIT_RESERVATION_SUBMIT_ERROR]', requestError)

            setResFormError(getErrorMessage(requestError, 'Cập nhật đặt bàn thất bại.'))
        } finally {
            setSubmitting(false)
        }
    }

    async function handleCancelReservation() {
        if (!reservationId) {
            showToast('Không xác định được đặt bàn.', 'error')
            return
        }

        setCanceling(true)

        try {
            await waiterApi.cancelReservation(reservationId)

            showToast('Đã hủy đặt bàn')

            window.setTimeout(() => navigate('/waiter/tables'), 800)
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[WAITER_EDIT_RESERVATION_CANCEL_ERROR]', requestError)

            showToast(getErrorMessage(requestError, 'Hủy đặt bàn thất bại.'), 'error')
        } finally {
            setCanceling(false)
        }
    }

    const selectedTableNumber =
        tables.find((table) => table.tableId === resForm.tableId)?.tableNumber ?? '...'

    return (
        <div className="waiter-container">
            <WaiterHeader />

            <main className="waiter-main">
                <div className="waiter-sub-header">
                    <h2 className="waiter-title">Sửa Đặt Bàn</h2>
                </div>

                <div className="waiter-res-layout">
                    <div className="waiter-card">
                        <div className="waiter-card-header">
                            Thông tin đặt bàn — {reservationId || '—'}
                        </div>

                        <div className="waiter-card-body">
                            {resFormError && (
                                <div className="waiter-form-error">{resFormError}</div>
                            )}

                            {isDetailLoading ? (
                                <div style={stateBoxStyle}>
                                    Đang tải thông tin đặt bàn...
                                </div>
                            ) : (
                                <>
                                    <div className="waiter-form-group">
                                        <label>Tên khách hàng</label>
                                        <input
                                            value={resForm.customerName}
                                            className="waiter-form-input"
                                            maxLength={50}
                                            onChange={(event) =>
                                                updateForm({
                                                    customerName: event.target.value,
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="waiter-form-group">
                                        <label>Số điện thoại</label>
                                        <input
                                            value={resForm.phone}
                                            pattern="0[0-9]{9}"
                                            className="waiter-form-input"
                                            onChange={(event) =>
                                                updateForm({
                                                    phone: event.target.value
                                                        .replace(/\D/g, '')
                                                        .slice(0, 10),
                                                })
                                            }
                                        />
                                    </div>

                                    <div style={dateTimeRowStyle}>
                                        <div
                                            className="waiter-form-group"
                                            style={{
                                                flex: 1,
                                            }}
                                        >
                                            <label>Ngày đặt</label>
                                            <input
                                                type="date"
                                                value={resForm.date}
                                                className="waiter-form-input"
                                                onChange={(event) =>
                                                    updateForm({
                                                        date: event.target.value,
                                                    })
                                                }
                                            />
                                        </div>

                                        <div
                                            className="waiter-form-group"
                                            style={{
                                                flex: 1,
                                            }}
                                        >
                                            <label>Giờ đặt</label>
                                            <select
                                                value={resForm.time}
                                                className="waiter-form-input"
                                                onChange={(event) =>
                                                    updateForm({
                                                        time: event.target.value,
                                                    })
                                                }
                                            >
                                                {availableTimeSlots.map((value) => (
                                                    <option key={value} value={value}>
                                                        {value}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="waiter-form-group">
                                        <label>Bàn</label>
                                        <select
                                            value={resForm.tableId}
                                            className="waiter-form-input"
                                            disabled={isTablesLoading}
                                            onChange={(event) =>
                                                updateForm({
                                                    tableId: Number.parseInt(
                                                        event.target.value,
                                                        10,
                                                    ),
                                                })
                                            }
                                        >
                                            <option value={0}>
                                                {isTablesLoading
                                                    ? 'Đang tải bàn...'
                                                    : 'Chọn bàn'}
                                            </option>

                                            {tables.map((table) => (
                                                <option
                                                    key={table.tableId}
                                                    value={table.tableId}
                                                >
                                                    Bàn {table.tableNumber} (
                                                    {table.capacity} chỗ)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="waiter-form-group">
                                        <label>Ghi chú</label>
                                        <textarea
                                            value={resForm.note}
                                            className="waiter-form-input"
                                            rows={3}
                                            maxLength={100}
                                            onChange={(event) =>
                                                updateForm({
                                                    note: event.target.value,
                                                })
                                            }
                                        />
                                    </div>

                                    <div style={actionRowStyle}>
                                        <button
                                            type="button"
                                            className="waiter-btn-primary"
                                            style={{
                                                flex: 1,
                                            }}
                                            disabled={submitting || canceling}
                                            onClick={() => void submitReservation()}
                                        >
                                            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                                        </button>

                                        <button
                                            type="button"
                                            className="waiter-btn-outline"
                                            style={cancelButtonStyle}
                                            disabled={submitting || canceling}
                                            onClick={() => void handleCancelReservation()}
                                        >
                                            {canceling ? 'Đang hủy...' : 'Hủy đặt bàn'}
                                        </button>

                                        <button
                                            type="button"
                                            className="waiter-btn-outline"
                                            disabled={submitting || canceling}
                                            onClick={() => navigate('/waiter/tables')}
                                        >
                                            Quay lại
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="waiter-card">
                        <div className="waiter-card-header">
                            Lịch đặt cùng ngày (Bàn {selectedTableNumber})
                        </div>

                        <div className="waiter-card-body waiter-res-list">
                            {!resForm.tableId || !resForm.date ? (
                                <p style={emptyTextStyle}>
                                    Chọn bàn và ngày để xem lịch đặt.
                                </p>
                            ) : isReservationsLoading ? (
                                <p style={emptyTextStyle}>Đang tải lịch đặt...</p>
                            ) : rightReservations.length === 0 ? (
                                <p style={emptyTextStyle}>Không có lịch đặt nào.</p>
                            ) : (
                                rightReservations.map((reservation) => {
                                    const itemId = getReservationId(reservation)

                                    const {time} = splitReservationTime(
                                        reservation.reservationTime,
                                    )

                                    const isCurrent = itemId === reservationId

                                    return (
                                        <div
                                            key={
                                                itemId ??
                                                `${reservation.phone}-${reservation.reservationTime}`
                                            }
                                            className="waiter-res-card"
                                            style={{
                                                borderColor: isCurrent
                                                    ? '#3b82f6'
                                                    : undefined,
                                            }}
                                        >
                                            <div>
                                                <div className="waiter-res-time">
                                                    {time}
                                                </div>

                                                <div className="waiter-res-info">
                                                    <h4>{reservation.customerName}</h4>

                                                    <p>{reservation.phone}</p>
                                                </div>
                                            </div>

                                            {itemId && !isCurrent && (
                                                <button
                                                    type="button"
                                                    className="waiter-btn-outline"
                                                    style={editButtonStyle}
                                                    onClick={() =>
                                                        navigate(
                                                            `/waiter/reservations/${itemId}/edit`,
                                                        )
                                                    }
                                                >
                                                    Sửa
                                                </button>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <WaiterToast toast={toast} />
        </div>
    )
}

const stateBoxStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#64748b',
}

const dateTimeRowStyle: CSSProperties = {
    display: 'flex',
    gap: '1.25rem',
}

const actionRowStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.75rem',
    flexWrap: 'wrap',
}

const cancelButtonStyle: CSSProperties = {
    color: '#ef4444',
    borderColor: '#fca5a5',
}

const emptyTextStyle: CSSProperties = {
    color: '#94a3b8',
    fontWeight: 500,
}

const editButtonStyle: CSSProperties = {
    padding: '0.35rem 0.85rem',
}
