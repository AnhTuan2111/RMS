import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from 'react'
import {
    useNavigate,
    useParams,
} from 'react-router-dom'

import {
    type MenuItemResponse,
    type OrderDetailResponse,
    type OrderItemStatus,
    type UpdateOrderItemRequest,
    waiterApi,
} from '@/shared/api/waiter'
import {
    BackArrow,
    ConfirmModal,
    fmtPrice,
    WaiterHeader,
    WaiterToast,
} from './components'
import {useWaiterSocket} from '@/realtime'

type DraftItem = {
    qty: number
    originalQty?: number
    originalNote?: string
    note: string
    orderItemId?: number | null
    status?: OrderItemStatus
    cancelReason?: string | null
    chefInternalNote?: string | null
    chefInternalNoteCreatedAt?: string | null
    chefInternalNoteAcknowledgedAt?: string | null
}

type ToastState = {
    msg: string
    type: string
} | null

type UpdateItemWithName = UpdateOrderItemRequest & {
    name: string
}
type ChangeKind = 'new' | 'increase' | 'decrease' | 'cancel' | 'note'

type ChangeSummaryItem = {
    dishId: number
    name: string
    kind: ChangeKind
    qty: number
    note?: string
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
        requestError.name === 'CanceledError'
        || requestError.code === 'ERR_CANCELED'
        || requestError.message === 'canceled'
    )
}

function getRequestErrorMessage(
    error: unknown,
    fallback: string,
) {
    if (typeof error !== 'object' || error === null) {
        return fallback
    }

    const requestError = error as {
        response?: {
            data?: string | {
                message?: string
                details?: Record<string, string>
            }
        }
        message?: string
    }

    const responseData = requestError.response?.data

    if (typeof responseData === 'string') {
        return responseData
    }

    if (
        responseData?.details
        && Object.keys(responseData.details).length > 0
    ) {
        return Object.entries(responseData.details)
            .map(([key, value]) => `${key}: ${value}`)
            .join('; ')
    }

    if (responseData?.message) {
        return responseData.message
    }

    return requestError.message || fallback
}

function formatChefNoteTime(value?: string | null) {
    if (!value) {
        return ''
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

function buildDraftFromOrders(
    menu: MenuItemResponse[],
    orders: OrderDetailResponse[],
) {
    const draft: Record<number, DraftItem> = {}

    orders.forEach((order) => {
        order.orderItems.forEach((item) => {
            const dish =
                menu.find(
                    (menuItem) =>
                        menuItem.name === item.dishName,
                )

            if (!dish) {
                return
            }

            draft[dish.dishId] = {
                qty: item.quantity,
                originalQty: item.quantity,
                originalNote: item.note ?? '',
                note: item.note ?? '',
                orderItemId: item.orderItemId,
                status: item.status,
                cancelReason: item.cancelReason,
                chefInternalNote: item.chefInternalNote,
                chefInternalNoteCreatedAt:
                item.chefInternalNoteCreatedAt,
                chefInternalNoteAcknowledgedAt:
                item.chefInternalNoteAcknowledgedAt,
            }
        })
    })

    return draft
}

function getChefNoteBoxStyle(
    acknowledged: boolean,
): CSSProperties {
    return {
        margin: '0.85rem 0',
        padding: '0.85rem 0.95rem',
        border: acknowledged
            ? '1px solid #cbd5e1'
            : '1px solid #f59e0b',
        borderLeft: acknowledged
            ? '4px solid #94a3b8'
            : '4px solid #f59e0b',
        borderRadius: '10px',
        background: acknowledged
            ? '#f8fafc'
            : '#fffbeb',
        color: acknowledged
            ? '#475569'
            : '#78350f',
    }
}

export default function WaiterUpdateOrderPage() {
    const navigate = useNavigate()
    const {tableId} = useParams()

    const tableIdNumber =
        Number.parseInt(tableId ?? '0', 10)

    const [menu, setMenu] =
        useState<MenuItemResponse[]>([])

    const [servingOrders, setServingOrders] =
        useState<OrderDetailResponse[]>([])

    const [orderDraft, setOrderDraft] =
        useState<Record<number, DraftItem>>({})

    const [toast, setToast] =
        useState<ToastState>(null)

    const [showConfirm, setShowConfirm] =
        useState(false)

    const [submitting, setSubmitting] =
        useState(false)

    const [successData, setSuccessData] =
        useState<{
            message: string
            itemSummary: string
        } | null>(null)

    const [activeCategory, setActiveCategory] =
        useState('Tất cả')

    const [searchQuery, setSearchQuery] =
        useState('')

    const [acknowledgingItemId, setAcknowledgingItemId] =
        useState<number | null>(null)

    const [isLoading, setIsLoading] =
        useState(true)

    const [pageError, setPageError] =
        useState<string | null>(null)



    const hasUserEditedDraftRef =
        useRef(false)

    function showToast(
        msg: string,
        type = 'success',
    ) {
        setToast({
            msg,
            type,
        })

        window.setTimeout(
            () => setToast(null),
            3000,
        )
    }

    const loadOrderData = useCallback(
        async (
            signal?: AbortSignal,
            showFullLoading = true,
        ) => {
            if (!tableIdNumber) {
                setPageError('Mã bàn không hợp lệ.')
                setIsLoading(false)
                return
            }

            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                setPageError(null)

                const [
                    menuResponse,
                    orderResponse,
                ] =
                    await Promise.all([
                        waiterApi.getMenu(signal),
                        waiterApi.getServingOrders(
                            tableIdNumber,
                            signal,
                        ),
                    ])

                if (signal?.aborted) {
                    return
                }

                const nextMenu = menuResponse.data
                const nextOrders = orderResponse.data ?? []

                setMenu(nextMenu)
                setServingOrders(nextOrders)

                if (
                    !hasUserEditedDraftRef.current
                    && !showConfirm
                    && !submitting
                ) {
                    setOrderDraft(
                        buildDraftFromOrders(
                            nextMenu,
                            nextOrders,
                        ),
                    )
                }
            } catch (requestError: unknown) {
                if (
                    signal?.aborted
                    || isRequestCanceled(requestError)
                ) {
                    return
                }

                console.error(
                    '[WAITER_UPDATE_ORDER_LOAD_ERROR]',
                    requestError,
                )

                setPageError(
                    'Không thể tải dữ liệu cập nhật đơn hàng.',
                )
            } finally {
                if (
                    showFullLoading
                    && !signal?.aborted
                ) {
                    setIsLoading(false)
                }
            }
        },
        [
            showConfirm,
            submitting,
            tableIdNumber,
        ],
    )

    // Initial load on mount
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadOrderData()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadOrderData])

    // WebSocket: refresh when backend broadcasts waiter or table updates
    useWaiterSocket(
        () => void loadOrderData(undefined, false),
        () => void loadOrderData(undefined, false),
    )

    function getMinQty(dishId: number) {
        const current = orderDraft[dishId]

        if (!current) {
            return 0
        }

        if (current.status === 'COMPLETED') {
            return current.originalQty ?? 0
        }

        return 0
    }

    const categories =
        useMemo(
            () => [
                'Tất cả',
                ...Array.from(
                    new Set(
                        menu
                            .map((dish) => dish.categoryName)
                            .filter(Boolean),
                    ),
                ),
            ],
            [menu],
        )

    const visibleMenu =
        useMemo(
            () =>
                menu.filter((dish) => {
                    const matchesCategory =
                        activeCategory === 'Tất cả'
                        || dish.categoryName === activeCategory

                    const matchesSearch =
                        dish.name
                            .toLowerCase()
                            .includes(
                                searchQuery.trim().toLowerCase(),
                            )

                    return matchesCategory && matchesSearch
                }),
            [
                menu,
                activeCategory,
                searchQuery,
            ],
        )

    const updateItems =
        useMemo<UpdateItemWithName[]>(
            () =>
                Object.entries(orderDraft)
                    .filter(([, value]) => {
                        if (!value.orderItemId) {
                            return value.qty > 0
                        }

                        return true
                    })
                    .filter(([, value]) =>
                            value.qty > 0
                            || (
                                value.orderItemId
                                && value.status === 'PREPARING'
                            ),
                    )
                    .map(([dishId, value]) => {
                        const numericDishId =
                            Number.parseInt(dishId, 10)

                        return {
                            orderItemId:
                                value.orderItemId ?? null,

                            dishId: numericDishId,
                            quantity: value.qty,
                            note: value.note || '',
                            name:
                                menu.find(
                                    (dish) =>
                                        dish.dishId
                                        === numericDishId,
                                )?.name
                                ?? 'Món',
                        }
                    }),
            [
                orderDraft,
                menu,
            ],
        )

    const changeSummary =
        useMemo<ChangeSummaryItem[]>(
            () => {
                const result: ChangeSummaryItem[] = []

                Object.entries(orderDraft).forEach(
                    ([dishId, value]) => {
                        const numericDishId =
                            Number.parseInt(dishId, 10)

                        const name =
                            menu.find(
                                (dish) =>
                                    dish.dishId === numericDishId,
                            )?.name ?? 'Món'

                        const isNew = !value.orderItemId

                        if (isNew) {
                            if (value.qty > 0) {
                                result.push({
                                    dishId: numericDishId,
                                    name,
                                    kind: 'new',
                                    qty: value.qty,
                                    note: value.note || undefined,
                                })
                            }
                            return
                        }

                        const original = value.originalQty ?? 0
                        const delta = value.qty - original

                        if (value.qty === 0 && original > 0) {
                            result.push({
                                dishId: numericDishId,
                                name,
                                kind: 'cancel',
                                qty: 0,
                            })
                        } else if (delta > 0) {
                            result.push({
                                dishId: numericDishId,
                                name,
                                kind: 'increase',
                                qty: delta,
                                note: value.note || undefined,
                            })
                        } else if (delta < 0) {
                            result.push({
                                dishId: numericDishId,
                                name,
                                kind: 'decrease',
                                qty: Math.abs(delta),
                                note: value.note || undefined,
                            })
                        } else if (
                            (value.note || '')
                            !== (value.originalNote || '')
                        ) {
                            result.push({
                                dishId: numericDishId,
                                name,
                                kind: 'note',
                                qty: value.qty,
                                note: value.note || undefined,
                            })
                        }
                    },
                )

                return result
            },
            [orderDraft, menu],
        )

    function openConfirm() {
        if (!servingOrders.length) {
            showToast(
                'Không có đơn hàng đang phục vụ để cập nhật.',
                'error',
            )
            return
        }

        if (changeSummary.length === 0) {
            showToast(
                'Không có thay đổi nào để cập nhật.',
                'error',
            )
            return
        }

        setShowConfirm(true)
    }

    async function submitUpdateOrder() {
        if (!servingOrders.length) {
            return
        }

        const targetOrderId =
            servingOrders[0].orderId

        const items: UpdateOrderItemRequest[] =
            updateItems.map((item) => ({
                orderItemId: item.orderItemId,
                dishId: item.dishId,
                quantity: item.quantity,
                note: item.note,
            }))

        setSubmitting(true)

        try {
            const response =
                await waiterApi.updateOrder(
                    targetOrderId,
                    {
                        items,
                    },
                )

            hasUserEditedDraftRef.current = false

            setSuccessData({
                message:
                    response.data?.message
                    || 'Cập nhật đơn hàng thành công!',
                itemSummary: '',
            })
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[WAITER_UPDATE_ORDER_SUBMIT_ERROR]',
                requestError,
            )

            showToast(
                `Cập nhật thất bại: ${
                    getRequestErrorMessage(
                        requestError,
                        'Lỗi không xác định',
                    )
                }`,
                'error',
            )
        } finally {
            setSubmitting(false)
            setShowConfirm(false)
        }
    }

    function changeDraftQty(
        dishId: number,
        delta: number,
    ) {
        hasUserEditedDraftRef.current = true

        setOrderDraft((previous) => {
            const current =
                previous[dishId] ?? {
                    qty: 0,
                    note: '',
                    orderItemId: null,
                }

            if (current.status === 'CANCELLED') {
                const qty =
                    Math.max(
                        0,
                        current.qty + delta,
                    )

                if (
                    current.qty === 0
                    && qty > 0
                ) {
                    return {
                        ...previous,
                        [dishId]: {
                            qty,
                            note: current.note,
                            orderItemId: null,
                            status: undefined,
                        },
                    }
                }

                return {
                    ...previous,
                    [dishId]: {
                        ...current,
                        qty,
                    },
                }
            }

            const minQty =
                getMinQty(dishId)

            const qty =
                Math.max(
                    minQty,
                    current.qty + delta,
                )

            return {
                ...previous,
                [dishId]: {
                    ...current,
                    qty,
                },
            }
        })
    }

    function setDraftNote(
        dishId: number,
        note: string,
    ) {
        hasUserEditedDraftRef.current = true

        setOrderDraft((previous) => {
            const current =
                previous[dishId] ?? {
                    qty: 0,
                    note: '',
                    orderItemId: null,
                }

            return {
                ...previous,
                [dishId]: {
                    ...current,
                    note,
                },
            }
        })
    }

    async function handleAcknowledgeChefNote(
        dishId: number,
        orderItemId: number,
    ) {
        try {
            setAcknowledgingItemId(orderItemId)

            await waiterApi.acknowledgeChefInternalNote(
                orderItemId,
            )

            setOrderDraft((currentDraft) => ({
                ...currentDraft,
                [dishId]: {
                    ...currentDraft[dishId],
                    chefInternalNoteAcknowledgedAt:
                        new Date().toISOString(),
                },
            }))

            showToast('Đã xác nhận ghi chú từ bếp.')
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[WAITER_UPDATE_ORDER_ACK_NOTE_ERROR]',
                requestError,
            )

            showToast(
                getRequestErrorMessage(
                    requestError,
                    'Không thể xác nhận ghi chú từ bếp.',
                ),
                'error',
            )
        } finally {
            setAcknowledgingItemId(null)
        }
    }

    return (
        <div className="waiter-container">
            <WaiterHeader />

            <main className="waiter-main">
                <div className="waiter-sub-header">
                    <BackArrow
                        onClick={() =>
                            navigate(
                                `/waiter/tables/${tableIdNumber}/order/detail`,
                            )
                        }
                    />

                    <h2 className="waiter-title">
                        Cập nhật đơn hàng - Bàn {tableIdNumber || '—'}
                    </h2>

                    <button
                        type="button"
                        className="waiter-action-btn"
                        disabled={
                            isLoading
                            || submitting
                            || !tableIdNumber
                        }
                        onClick={openConfirm}
                    >
                        Lưu Cập Nhật
                    </button>
                </div>

                <input
                    type="text"
                    placeholder="Tìm kiếm món ăn..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="waiter-search-input"
                />

                <div className="waiter-category-nav">
                    {categories.map((category) => (
                        <button
                            key={category}
                            type="button"
                            className={`waiter-category-tab${
                                activeCategory === category
                                    ? ' waiter-category-tab-active'
                                    : ''
                            }`}
                            onClick={() =>
                                setActiveCategory(category)
                            }
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {pageError && (
                    <div
                        className="waiter-form-error"
                        style={errorBoxStyle}
                    >
                        {pageError}

                        <button
                            type="button"
                            className="waiter-btn-outline"
                            style={retryButtonStyle}
                            onClick={() =>
                                void loadOrderData(
                                    undefined,
                                    true,
                                )
                            }
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div style={stateBoxStyle}>
                        Đang tải dữ liệu cập nhật đơn hàng...
                    </div>
                ) : visibleMenu.length === 0 ? (
                    <div style={stateBoxStyle}>
                        Không có món nào trong danh mục này.
                    </div>
                ) : (
                    <div className="waiter-menu-grid">
                        {visibleMenu.map((dish) => {
                            const draft =
                                orderDraft[dish.dishId] ?? {
                                    qty: 0,
                                    note: '',
                                }

                            const minQty =
                                getMinQty(dish.dishId)

                            const hasExisting =
                                Boolean(draft.status)

                            const noteAcknowledged =
                                Boolean(
                                    draft.chefInternalNoteAcknowledgedAt,
                                )

                            const isUnavailable = !dish.available

                            return (
                                <div
                                    key={dish.dishId}
                                    className="waiter-menu-card"
                                    style={
                                        isUnavailable
                                            ? {opacity: 0.5}
                                            : undefined
                                    }
                                >
                                    <div className="waiter-menu-card-top">
                                        {dish.imageUrl ? (
                                            <img
                                                src={dish.imageUrl.startsWith('http') ? dish.imageUrl : `/image/${dish.imageUrl}`}
                                                alt={dish.name}
                                                className="waiter-menu-img"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://placehold.co/64x64?text=🍽️'
                                                }}
                                            />
                                        ) : (
                                            <span className="waiter-menu-emoji">🍽️</span>
                                        )}

                                        <div className="waiter-menu-info">
                                            <h4>{dish.name}</h4>
                                            <p>{fmtPrice(dish.price)}</p>

                                            {hasExisting && draft.status && (
                                                <span
                                                    className={`waiter-badge waiter-badge-${draft.status.toLowerCase()}`}
                                                >
                                                    {draft.status}
                                                </span>
                                            )}

                                            {!hasExisting && isUnavailable && (
                                                <span className="waiter-badge waiter-badge-cancelled">
                                                    Hết hàng
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {draft.chefInternalNote && (
                                        <div
                                            style={getChefNoteBoxStyle(
                                                noteAcknowledged,
                                            )}
                                        >
                                            <div style={chefNoteHeaderStyle}>
                                                <strong>
                                                    🔔 Bếp nhắn
                                                </strong>

                                                {draft.chefInternalNoteCreatedAt && (
                                                    <span style={chefNoteTimeStyle}>
                                                        {formatChefNoteTime(
                                                            draft.chefInternalNoteCreatedAt,
                                                        )}
                                                    </span>
                                                )}
                                            </div>

                                            <p style={chefNoteContentStyle}>
                                                {draft.chefInternalNote}
                                            </p>

                                            {noteAcknowledged ? (
                                                <small style={seenTextStyle}>
                                                    ✓ Đã xem
                                                </small>
                                            ) : (
                                                draft.orderItemId && (
                                                    <button
                                                        type="button"
                                                        className="waiter-btn-outline"
                                                        style={ackButtonStyle}
                                                        disabled={
                                                            acknowledgingItemId
                                                            === draft.orderItemId
                                                        }
                                                        onClick={() =>
                                                            void handleAcknowledgeChefNote(
                                                                dish.dishId,
                                                                draft.orderItemId!,
                                                            )
                                                        }
                                                    >
                                                        {acknowledgingItemId
                                                        === draft.orderItemId
                                                            ? 'Đang xác nhận...'
                                                            : 'Đã xem'}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}

                                    <div className="waiter-qty-controls">
                                        <button
                                            type="button"
                                            className="waiter-qty-btn"
                                            disabled={draft.qty <= minQty}
                                            onClick={() =>
                                                changeDraftQty(
                                                    dish.dishId,
                                                    -1,
                                                )
                                            }
                                        >
                                            -
                                        </button>

                                        <span className="waiter-qty-val">
                                            {draft.qty}
                                        </span>

                                        <button
                                            type="button"
                                            className="waiter-qty-btn"
                                            disabled={isUnavailable}
                                            onClick={() =>
                                                changeDraftQty(
                                                    dish.dishId,
                                                    1,
                                                )
                                            }
                                        >
                                            +
                                        </button>
                                    </div>

                                    <input
                                        placeholder="Ghi chú (ít cay, ...)"
                                        value={draft.note}
                                        className="waiter-note-input"
                                        onChange={(event) =>
                                            setDraftNote(
                                                dish.dishId,
                                                event.target.value,
                                            )
                                        }
                                    />

                                    {isUnavailable && (
                                        <p className="waiter-item-hint">
                                            Món hiện đang tạm hết — không thể gọi thêm.
                                        </p>
                                    )}

                                    {draft.status === 'COMPLETED' && (
                                        <p className="waiter-item-hint">
                                            Món đã hoàn thành — không thể giảm
                                            số lượng dưới {minQty}.
                                        </p>
                                    )}

                                    {draft.status === 'CANCELLED' && (
                                        <>
                                            <p className="waiter-item-hint">
                                                Món đã hủy — nhấn + để thêm mới
                                                từ đầu.
                                            </p>

                                            {draft.cancelReason && (
                                                <p style={cancelReasonStyle}>
                                                    Lý do hủy:{' '}
                                                    {draft.cancelReason}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {showConfirm && (
                <ConfirmModal
                    title="Xác nhận cập nhật đơn hàng"
                    message={`Bàn ${tableIdNumber} — Bạn đang gửi yêu cầu cập nhật các món sau:`}
                    confirmLabel={
                        submitting
                            ? 'Đang gửi...'
                            : 'Xác nhận'
                    }
                    onCancel={() => {
                        if (!submitting) {
                            setShowConfirm(false)
                        }
                    }}
                    onConfirm={() => {
                        if (!submitting) {
                            void submitUpdateOrder()
                        }
                    }}
                >
                    <ul className="waiter-confirm-list">
                        {changeSummary.map((item) => (
                            <li key={item.dishId}>
                                <span>
                                    {item.name}
                                    {item.kind === 'new'
                                        && ` × ${item.qty} (Món mới)`}
                                    {item.kind === 'increase'
                                        && ` +${item.qty}`}
                                    {item.kind === 'decrease'
                                        && ` −${item.qty}`}
                                    {item.kind === 'cancel'
                                        && ' (Hủy món)'}
                                    {item.kind === 'note'
                                        && ' (Cập nhật ghi chú)'}
                                </span>

                                {item.note && (
                                    <small>
                                        Ghi chú: {item.note}
                                    </small>
                                )}
                            </li>
                        ))}
                    </ul>
                </ConfirmModal>
            )}

            {successData && (
                <ConfirmModal
                    title="Thành công"
                    message={successData.message}
                    confirmLabel="Đóng"
                    cancelLabel=""
                    onConfirm={() =>
                        navigate('/waiter/tables')
                    }
                    onCancel={() =>
                        navigate('/waiter/tables')
                    }
                >
                    <div style={successSummaryStyle}>
                        {successData.itemSummary}
                    </div>
                </ConfirmModal>
            )}

            <WaiterToast toast={toast} />
        </div>
    )
}

const stateBoxStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#64748b',
}

const errorBoxStyle: CSSProperties = {
    marginBottom: '1rem',
}

const retryButtonStyle: CSSProperties = {
    marginLeft: '0.75rem',
}

const chefNoteHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
}

const chefNoteTimeStyle: CSSProperties = {
    fontSize: '0.75rem',
    color: '#64748b',
}

const chefNoteContentStyle: CSSProperties = {
    margin: '0.45rem 0',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.45,
}

const seenTextStyle: CSSProperties = {
    color: '#15803d',
    fontWeight: 700,
}

const ackButtonStyle: CSSProperties = {
    marginTop: '0.25rem',
    padding: '0.4rem 0.75rem',
}

const cancelReasonStyle: CSSProperties = {
    margin: '0.25rem 0 0',
    color: '#dc2626',
    fontSize: '0.85rem',
    fontWeight: 600,
    lineHeight: 1.4,
}

const successSummaryStyle: CSSProperties = {
    marginTop: '1rem',
    whiteSpace: 'pre-wrap',
    color: '#475569',
}
