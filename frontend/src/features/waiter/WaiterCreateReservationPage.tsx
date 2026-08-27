import {useEffect, useMemo, useRef, useState, type CSSProperties} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'

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

function todayString() {
    const date = new Date()

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-')
}

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

function getRequestErrorMessage(error: unknown, fallback: string) {
    if (typeof error !== 'object' || error === null) {
        return fallback
    }

    const requestError = error as {
        response?: {
            data?:
                | string
                | {
                      message?: string
                  }
        }
        message?: string
    }

    const responseData = requestError.response?.data

    if (typeof responseData === 'string') {
        return responseData
    }

    if (responseData?.message) {
        return responseData.message
    }

    return requestError.message || fallback
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

export default function WaiterCreateReservationPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const preselectedTable = Number.parseInt(searchParams.get('tableId') ?? '0', 10)

    const [tables, setTables] = useState<TableDetailResponse[]>([])

    const [toast, setToast] = useState<ToastState>(null)

    const [resFormError, setResFormError] = useState('')

    const [rightReservations, setRightReservations] = useState<ReservationResponse[]>([])

    const [blockedRanges, setBlockedRanges] = useState<TimeRangeResponse[]>([])

    const [resForm, setResForm] = useState<ReservationForm>({
        customerName: '',
        phone: '',
        date: todayString(),
        time: '08:00',
        tableId: preselectedTable || 0,
        note: '',
    })

    const [isTablesLoading, setIsTablesLoading] = useState(true)

    const [isReservationsLoading, setIsReservationsLoading] = useState(false)

    const [submitting, setSubmitting] = useState(false)

    const hasLoadedInitialTablesRef = useRef(false)

    const hasLoadedInitialReservationsRef = useRef(false)

    const availableTimeSlots = useMemo(
        () => getAvailableTimeSlots(resForm.date, blockedRanges),
        [resForm.date, blockedRanges],
    )

    // Nếu giờ đang chọn không còn nằm trong danh sách slot khả dụng
    // (do đã qua giờ đó, hoặc slot vừa bị chặn), tự chuyển sang slot
    // đầu tiên còn khả dụng — tránh submit với giờ đã ở quá khứ.
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

            console.error('[WAITER_CREATE_RESERVATION_TABLES_ERROR]', requestError)

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

            console.error('[WAITER_CREATE_RESERVATION_LIST_ERROR]', requestError)

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
                undefined,
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

            console.error('[WAITER_BLOCKED_SLOTS_ERROR]', requestError)

            setBlockedRanges([])
        }
    }

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
                console.error(
                    '[WAITER_CREATE_RESERVATION_TABLES_POLL_ERROR]',
                    requestError,
                )
            },
        },
    )

    usePolling(
        async (signal) => {
            const isInitialLoad = !hasLoadedInitialReservationsRef.current

            await loadReservations(signal, isInitialLoad)

            await loadBlockedSlots(signal)

            hasLoadedInitialReservationsRef.current = true
        },
        {
            intervalMs: REALTIME_CONFIG.waiter.tablesIntervalMs,

            runImmediately: true,
            pauseWhenHidden: true,

            onError: (requestError) => {
                console.error('[WAITER_CREATE_RESERVATION_LIST_POLL_ERROR]', requestError)
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
            await waiterApi.createReservation(payload)

            showToast('Đã tạo đặt bàn')
            setResFormError('')

            setResForm({
                customerName: '',
                phone: '',
                date: todayString(),
                time: '08:00',
                tableId: preselectedTable || 0,
                note: '',
            })

            await loadReservations(undefined, true, {
                tableId,
                date,
            })
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[WAITER_CREATE_RESERVATION_SUBMIT_ERROR]', requestError)

            setResFormError(
                getRequestErrorMessage(
                    requestError,
                    'Đặt bàn thất bại. Vui lòng thử lại.',
                ),
            )
        } finally {
            setSubmitting(false)
        }
    }

    const selectedTableNumber =
        tables.find((table) => table.tableId === resForm.tableId)?.tableNumber ?? '...'

    return (
        <div className="waiter-container">
            <WaiterHeader />

            <main className="waiter-main">
                <div className="waiter-sub-header">
                    <h2 className="waiter-title">Đặt Bàn</h2>
                </div>

                <div className="waiter-res-layout">
                    <div className="waiter-card">
                        <div className="waiter-card-header">Thông tin đặt bàn</div>

                        <div className="waiter-card-body">
                            {resFormError && (
                                <div className="waiter-form-error">{resFormError}</div>
                            )}

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
                                    className="waiter-form-input"
                                    pattern="0[0-9]{9}"
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
                                    <label>Giờ đặt bàn</label>
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
                                        {isTablesLoading ? 'Đang tải bàn...' : 'Chọn bàn'}
                                    </option>

                                    {tables.map((table) => (
                                        <option key={table.tableId} value={table.tableId}>
                                            Bàn {table.tableNumber} ({table.capacity} chỗ)
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
                                    disabled={submitting}
                                    onClick={() => void submitReservation()}
                                >
                                    {submitting ? 'Đang lưu...' : 'Lưu đặt bàn'}
                                </button>

                                <button
                                    type="button"
                                    className="waiter-btn-outline"
                                    disabled={submitting}
                                    onClick={() => navigate('/waiter/tables')}
                                >
                                    Hủy
                                </button>
                            </div>
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
                                    const reservationId = getReservationId(reservation)

                                    const tableNo =
                                        tables.find(
                                            (table) =>
                                                table.tableId === reservation.tableId,
                                        )?.tableNumber ??
                                        reservation.tableNumber ??
                                        reservation.tableId

                                    const {date, time} = splitReservationTime(
                                        reservation.reservationTime,
                                    )

                                    return (
                                        <div
                                            key={
                                                reservationId ??
                                                `${reservation.phone}-${reservation.reservationTime}`
                                            }
                                            className="waiter-res-card"
                                        >
                                            <div>
                                                <div className="waiter-res-time">
                                                    {date} — {time}
                                                </div>

                                                <div className="waiter-res-info">
                                                    <h4>{reservation.customerName}</h4>

                                                    <p>
                                                        {reservation.phone}
                                                        {' · '}
                                                        Bàn {tableNo}
                                                    </p>

                                                    {reservation.note && (
                                                        <p style={noteStyle}>
                                                            {reservation.note}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {reservationId && (
                                                <button
                                                    type="button"
                                                    className="waiter-btn-outline"
                                                    style={editButtonStyle}
                                                    onClick={() =>
                                                        navigate(
                                                            `/waiter/reservations/${reservationId}/edit`,
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

const dateTimeRowStyle: CSSProperties = {
    display: 'flex',
    gap: '1.25rem',
}

const actionRowStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
    marginTop: '1.75rem',
}

const emptyTextStyle: CSSProperties = {
    color: '#94a3b8',
    fontWeight: 500,
}

const noteStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#64748b',
}

const editButtonStyle: CSSProperties = {
    padding: '0.35rem 0.85rem',
}
