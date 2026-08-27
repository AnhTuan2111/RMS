import {useCallback, useEffect, useRef, useState, type CSSProperties} from 'react'
import {useNavigate} from 'react-router-dom'

import * as waiterApi from '@/shared/api/waiter'
import type {ReservationResponse, TableDetailResponse} from '@/shared/api/waiter'
import {WaiterHeader, WaiterTableCard} from './components'
import {useWaiterSocket} from '@/realtime'
import {isRequestCanceled} from '@/shared/utils/error'

type WaiterTableStatus = 'AVAILABLE' | 'SERVING' | 'RESERVED'

const STATUS_META: Record<WaiterTableStatus, {label: string}> = {
    AVAILABLE: {label: '○ Bàn trống'},
    SERVING: {label: '● Đang phục vụ'},
    RESERVED: {label: '● Đã đặt trước'},
}

const NOTIFIABLE_ITEM_STATUSES = new Set<string>(['CANCELLED', 'COMPLETED'])

const ACKNOWLEDGED_SERVING_ITEMS_STORAGE_KEY = 'waiterAcknowledgedServingItems'

type ServingOrderNotificationSnapshot = Record<number, string[]>

type AcknowledgedServingItems = Record<number, Set<string>>

function getStatusAcknowledgementKey(itemKey: string, status: string) {
    return `status:${itemKey}:${status}`
}

function getChefNoteAcknowledgementKey(
    itemKey: string,
    noteCreatedAt?: string | null,
    noteContent?: string | null,
) {
    return `chef-note:${itemKey}:${noteCreatedAt ?? noteContent ?? ''}`
}

function readAcknowledgedServingItems(): AcknowledgedServingItems {
    try {
        const rawValue = localStorage.getItem(ACKNOWLEDGED_SERVING_ITEMS_STORAGE_KEY)

        if (!rawValue) {
            return {}
        }

        const parsedValue = JSON.parse(rawValue) as Record<string, unknown>

        return Object.fromEntries(
            Object.entries(parsedValue)
                .filter(
                    (entry): entry is [string, string[]] =>
                        Array.isArray(entry[1]) &&
                        entry[1].every((value) => typeof value === 'string'),
                )
                .map(([tableId, itemKeys]) => [Number(tableId), new Set(itemKeys)]),
        )
    } catch {
        return {}
    }
}

function saveAcknowledgedServingItems(acknowledgedItems: AcknowledgedServingItems) {
    const serializableValue = Object.fromEntries(
        Object.entries(acknowledgedItems).map(([tableId, itemKeys]) => [
            tableId,
            Array.from(itemKeys),
        ]),
    )

    localStorage.setItem(
        ACKNOWLEDGED_SERVING_ITEMS_STORAGE_KEY,
        JSON.stringify(serializableValue),
    )
}

function todayString() {
    const date = new Date()

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-')
}

function getReservationId(reservation: ReservationResponse) {
    return reservation.reservationId ?? reservation.id
}

function getReservationTime(value?: string | null) {
    if (!value) {
        return ''
    }

    return value.split('T')[1]?.substring(0, 5) ?? ''
}

function isUpcomingReservation(reservation: ReservationResponse) {
    if (reservation.status !== 'QUEUED' && reservation.status !== 'WAITING') {
        return false
    }

    if (!reservation.reservationTime) {
        return false
    }

    return new Date(reservation.reservationTime) > new Date()
}

export default function WaiterTableListPage() {
    const navigate = useNavigate()

    const servingNotificationsRef = useRef<ServingOrderNotificationSnapshot | null>(null)

    const acknowledgedServingItemsRef = useRef<AcknowledgedServingItems>(
        readAcknowledgedServingItems(),
    )

    const [tables, setTables] = useState<TableDetailResponse[]>([])

    const [tableModal, setTableModal] = useState<TableDetailResponse | null>(null)

    const [resTimes, setResTimes] = useState<Record<number, string>>({})

    const [modalReservations, setModalReservations] = useState<ReservationResponse[]>([])

    const [isLoading, setIsLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const [isModalLoading, setIsModalLoading] = useState(false)

    const [tableStatusNotifications, setTableStatusNotifications] = useState<
        Record<number, boolean>
    >({})

    const loadReservationTimesForReservedTables = useCallback(
        async (nextTables: TableDetailResponse[], signal?: AbortSignal) => {
            const reservedTables = nextTables.filter(
                (table) => table.status === 'RESERVED',
            )

            if (reservedTables.length === 0) {
                setResTimes({})
                return
            }

            const timeEntries = await Promise.all(
                reservedTables.map(async (table) => {
                    try {
                        const response = await waiterApi.getCurrentReservationByTable(
                            table.tableId,
                            signal,
                        )

                        if (signal?.aborted) {
                            return null
                        }

                        const reservationTime = response.data?.reservationTime

                        if (!reservationTime) {
                            return null
                        }

                        return [
                            table.tableId,
                            getReservationTime(reservationTime),
                        ] as const
                    } catch (requestError: unknown) {
                        if (signal?.aborted || isRequestCanceled(requestError)) {
                            return null
                        }

                        console.error('[WAITER_TABLE_RESERVED_TIME_ERROR]', requestError)

                        return null
                    }
                }),
            )

            if (signal?.aborted) {
                return
            }

            setResTimes(
                Object.fromEntries(
                    timeEntries.filter(Boolean) as Array<readonly [number, string]>,
                ),
            )
        },
        [],
    )

    const loadServingOrderStatuses = useCallback(
        async (nextTables: TableDetailResponse[], signal?: AbortSignal) => {
            const servingTables = nextTables.filter((table) => table.status === 'SERVING')

            const servingTableIds = new Set(servingTables.map((table) => table.tableId))

            if (servingTables.length === 0) {
                servingNotificationsRef.current = {}
                setTableStatusNotifications({})
                return
            }

            const notificationEntries = await Promise.all(
                servingTables.map(async (table) => {
                    try {
                        const response = await waiterApi.getServingOrders(
                            table.tableId,
                            signal,
                        )

                        if (signal?.aborted) {
                            return null
                        }

                        const itemNotificationKeys: string[] = []

                        response.data.forEach((order) => {
                            order.orderItems.forEach((item, itemIndex) => {
                                const itemKey = item.orderItemId
                                    ? String(item.orderItemId)
                                    : `${order.orderId}:${item.dishName}:${itemIndex}`

                                if (
                                    item.status &&
                                    NOTIFIABLE_ITEM_STATUSES.has(item.status)
                                ) {
                                    itemNotificationKeys.push(
                                        getStatusAcknowledgementKey(itemKey, item.status),
                                    )
                                }

                                if (
                                    item.chefInternalNote &&
                                    !item.chefInternalNoteAcknowledgedAt
                                ) {
                                    itemNotificationKeys.push(
                                        getChefNoteAcknowledgementKey(
                                            itemKey,
                                            item.chefInternalNoteCreatedAt,
                                            item.chefInternalNote,
                                        ),
                                    )
                                }
                            })
                        })

                        return [table.tableId, itemNotificationKeys] as const
                    } catch (requestError: unknown) {
                        if (signal?.aborted || isRequestCanceled(requestError)) {
                            return null
                        }

                        console.error('[WAITER_TABLE_SERVING_STATUS_ERROR]', requestError)

                        return null
                    }
                }),
            )

            if (signal?.aborted) {
                return
            }

            const nextSnapshot = Object.fromEntries(
                notificationEntries.filter(Boolean) as Array<readonly [number, string[]]>,
            )

            servingNotificationsRef.current = nextSnapshot

            const notifiedTableIds = Object.entries(nextSnapshot)
                .filter(([tableId, notificationKeys]) => {
                    const acknowledgedItems =
                        acknowledgedServingItemsRef.current[Number(tableId)]

                    return notificationKeys.some(
                        (notificationKey) => !acknowledgedItems?.has(notificationKey),
                    )
                })
                .map(([tableId]) => Number(tableId))

            setTableStatusNotifications((current) => {
                const nextNotifications: Record<number, boolean> = {}

                Object.entries(current).forEach(([tableId, hasNotification]) => {
                    const numericTableId = Number(tableId)

                    if (hasNotification && servingTableIds.has(numericTableId)) {
                        nextNotifications[numericTableId] = true
                    }
                })

                notifiedTableIds.forEach((tableId) => {
                    nextNotifications[tableId] = true
                })

                return nextNotifications
            })
        },
        [],
    )

    const loadTables = useCallback(
        async (signal?: AbortSignal, showFullLoading = true) => {
            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                setError(null)

                const response = await waiterApi.getTables(signal)

                if (signal?.aborted) {
                    return
                }

                setTables(response.data)

                await Promise.all([
                    loadReservationTimesForReservedTables(response.data, signal),
                    loadServingOrderStatuses(response.data, signal),
                ])
            } catch (requestError: unknown) {
                if (signal?.aborted || isRequestCanceled(requestError)) {
                    return
                }

                console.error('[WAITER_TABLE_LIST_FETCH_ERROR]', requestError)

                setError('Không thể tải danh sách bàn.')
            } finally {
                if (showFullLoading && !signal?.aborted) {
                    setIsLoading(false)
                }
            }
        },
        [loadReservationTimesForReservedTables, loadServingOrderStatuses],
    )

    // Initial load on mount
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadTables()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadTables])

    // WebSocket: refresh when backend broadcasts waiter or table updates
    useWaiterSocket(
        () => void loadTables(undefined, false),
        () => void loadTables(undefined, false),
    )

    async function handleTableClick(table: TableDetailResponse) {
        if (table.status === 'AVAILABLE') {
            setTableModal(table)
            setModalReservations([])
            setIsModalLoading(true)

            try {
                const response = await waiterApi.getReservationsByTableAndDate(
                    table.tableId,
                    todayString(),
                )

                const upcoming = (response.data ?? []).filter(isUpcomingReservation)

                setModalReservations(upcoming)
            } catch (requestError: unknown) {
                if (isRequestCanceled(requestError)) {
                    return
                }

                console.error('[WAITER_TABLE_MODAL_RESERVATIONS_ERROR]', requestError)

                setModalReservations([])
            } finally {
                setIsModalLoading(false)
            }

            return
        }

        if (table.status === 'SERVING') {
            const notificationKeys = servingNotificationsRef.current?.[table.tableId]

            if (notificationKeys) {
                const acknowledgedItems =
                    acknowledgedServingItemsRef.current[table.tableId] ??
                    new Set<string>()

                notificationKeys.forEach((notificationKey) => {
                    acknowledgedItems.add(notificationKey)
                })

                acknowledgedServingItemsRef.current = {
                    ...acknowledgedServingItemsRef.current,
                    [table.tableId]: acknowledgedItems,
                }

                saveAcknowledgedServingItems(acknowledgedServingItemsRef.current)
            }

            setTableStatusNotifications((current) => {
                if (!current[table.tableId]) {
                    return current
                }

                const nextNotifications = {
                    ...current,
                }

                delete nextNotifications[table.tableId]

                return nextNotifications
            })

            navigate(`/waiter/tables/${table.tableId}/order/detail`)
            return
        }

        if (table.status === 'RESERVED') {
            navigate(`/waiter/tables/${table.tableId}/reservation`)
        }
    }

    const displayTables = tables.slice(0, 12)

    return (
        <div className="waiter-container">
            <WaiterHeader />

            <main className="waiter-main">
                <div className="waiter-legend">
                    <span className="waiter-legend-item">
                        <span className="waiter-legend-dot waiter-dot-available" />
                        Bàn trống
                    </span>

                    <span className="waiter-legend-item">
                        <span className="waiter-legend-dot waiter-dot-serving" />
                        Đang phục vụ
                    </span>

                    <span className="waiter-legend-item">
                        <span className="waiter-legend-dot waiter-dot-reserved" />
                        Đã đặt trước
                    </span>
                </div>

                {isLoading ? (
                    <div style={stateBoxStyle}>Đang tải danh sách bàn...</div>
                ) : error ? (
                    <div style={errorBoxStyle}>
                        <p>{error}</p>

                        <button
                            type="button"
                            className="waiter-action-btn"
                            onClick={() => void loadTables(undefined, true)}
                        >
                            Thử lại
                        </button>
                    </div>
                ) : displayTables.length === 0 ? (
                    <div style={stateBoxStyle}>Chưa có bàn nào.</div>
                ) : (
                    <div className="waiter-table-grid">
                        {displayTables.map((table) => {
                            const status =
                                (table.status as WaiterTableStatus) in STATUS_META
                                    ? (table.status as WaiterTableStatus)
                                    : 'AVAILABLE'

                            const statusLabel = STATUS_META[status].label

                            const nextReservationTime = resTimes[table.tableId]

                            return (
                                <WaiterTableCard
                                    key={table.tableId}
                                    table={table}
                                    status={status}
                                    statusLabel={statusLabel}
                                    nextReservationTime={nextReservationTime}
                                    hasStatusNotification={Boolean(
                                        tableStatusNotifications[table.tableId],
                                    )}
                                    onClick={handleTableClick}
                                />
                            )
                        })}
                    </div>
                )}
            </main>

            {tableModal && (
                <div className="waiter-modal-overlay" onClick={() => setTableModal(null)}>
                    <div
                        className="waiter-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3>Bàn {tableModal.tableNumber}</h3>

                        {isModalLoading ? (
                            <p>Đang kiểm tra lịch đặt...</p>
                        ) : modalReservations.length > 0 ? (
                            <div className="waiter-warning-box">
                                <p>
                                    <strong>
                                        ⚠️ Bàn này đã có {modalReservations.length} lịch
                                        đặt trong hôm nay:
                                    </strong>
                                </p>

                                <ul style={reservationListStyle}>
                                    {modalReservations.map((reservation) => {
                                        const reservationTime = getReservationTime(
                                            reservation.reservationTime,
                                        )

                                        return (
                                            <li
                                                key={
                                                    getReservationId(reservation) ??
                                                    `${reservation.phone}-${reservation.reservationTime}`
                                                }
                                                style={reservationItemStyle}
                                            >
                                                <strong>{reservationTime}</strong>
                                                {' — '}
                                                {reservation.customerName}

                                                {reservation.phone && (
                                                    <span style={phoneStyle}>
                                                        {' '}
                                                        ({reservation.phone})
                                                    </span>
                                                )}

                                                {reservation.note && (
                                                    <span style={noteStyle}>
                                                        {' '}
                                                        · {reservation.note}
                                                    </span>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul>

                                <p style={{margin: 0}}>
                                    Vui lòng xác nhận với khách walk-in rằng họ có thể
                                    hoàn thành bữa ăn trước các khung giờ trên không. Nếu
                                    không, hãy <strong>chọn bàn khác</strong>.
                                </p>
                            </div>
                        ) : tableModal.upcomingReservationTime ? (
                            <div className="waiter-warning-box">
                                <p>
                                    <strong>⚠️ Cảnh báo:</strong> Bàn này đã được đặt
                                    trước bởi{' '}
                                    <b>{tableModal.upcomingCustomerName || 'Khách'}</b>{' '}
                                    vào lúc{' '}
                                    <b>
                                        {getReservationTime(
                                            tableModal.upcomingReservationTime,
                                        )}
                                    </b>
                                    .
                                </p>

                                <p>
                                    Vui lòng xác nhận với khách walk-in rằng họ có thể
                                    hoàn thành bữa ăn trước thời gian này không. Nếu
                                    không, hãy chọn bàn khác.
                                </p>
                            </div>
                        ) : (
                            <p>Bàn đang trống. Bạn muốn làm gì?</p>
                        )}

                        <div className="waiter-modal-actions">
                            <button
                                type="button"
                                className="waiter-btn-outline"
                                onClick={() => setTableModal(null)}
                            >
                                {modalReservations.length > 0 ||
                                tableModal.upcomingReservationTime
                                    ? 'Chọn Bàn Khác'
                                    : 'Hủy'}
                            </button>

                            <button
                                type="button"
                                className="waiter-btn-outline"
                                onClick={() =>
                                    navigate(
                                        `/waiter/reservations?tableId=${tableModal.tableId}`,
                                    )
                                }
                            >
                                Tạo Đặt Bàn
                            </button>

                            <button
                                type="button"
                                className="waiter-btn-primary"
                                onClick={() =>
                                    navigate(
                                        `/waiter/tables/${tableModal.tableId}/order/new`,
                                    )
                                }
                            >
                                Tạo đơn hàng
                            </button>
                        </div>
                    </div>
                </div>
            )}
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

const reservationListStyle: CSSProperties = {
    margin: '0.5rem 0 0.75rem 1.25rem',
    padding: 0,
}

const reservationItemStyle: CSSProperties = {
    marginBottom: '0.35rem',
}

const phoneStyle: CSSProperties = {
    color: '#78350f',
}

const noteStyle: CSSProperties = {
    color: '#92400e',
    fontSize: '0.82rem',
}
