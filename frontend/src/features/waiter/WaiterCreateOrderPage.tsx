
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'
import {
    useNavigate,
    useParams,
    useSearchParams,
} from 'react-router-dom'

import {
    type CreateOrderRequest,
    type MenuItemResponse,
    type OrderItemRequest,
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
    note: string
}

type ToastState = {
    msg: string
    type: string
} | null

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

export default function WaiterCreateOrderPage() {
    const navigate = useNavigate()
    const {tableId} = useParams()
    const [searchParams] = useSearchParams()

    const tableIdNumber =
        Number.parseInt(tableId ?? '0', 10)

    const reservationIdParam =
        searchParams.get('reservationId')

    const reservationId =
        reservationIdParam
            ? Number.parseInt(reservationIdParam, 10)
            : null

    const [menu, setMenu] =
        useState<MenuItemResponse[]>([])

    const [orderDraft, setOrderDraft] =
        useState<Record<number, DraftItem>>({})

    const [toast, setToast] =
        useState<ToastState>(null)

    const [showConfirm, setShowConfirm] =
        useState(false)

    const [submitting, setSubmitting] =
        useState(false)

    const [activeCategory, setActiveCategory] =
        useState('Tất cả')

    const [searchQuery, setSearchQuery] =
        useState('')

    const [successData, setSuccessData] =
        useState<{
            message: string
            itemSummary: string
        } | null>(null)

    const [isLoadingMenu, setIsLoadingMenu] =
        useState(true)

    const [menuError, setMenuError] =
        useState<string | null>(null)



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

    const loadMenu = useCallback(
        async (
            signal?: AbortSignal,
            showFullLoading = true,
        ) => {
            try {
                if (showFullLoading) {
                    setIsLoadingMenu(true)
                }

                setMenuError(null)

                const response =
                    await waiterApi.getMenu(signal)

                if (signal?.aborted) {
                    return
                }

                setMenu(response.data)
            } catch (requestError: unknown) {
                if (
                    signal?.aborted
                    || isRequestCanceled(requestError)
                ) {
                    return
                }

                console.error(
                    '[WAITER_CREATE_ORDER_MENU_ERROR]',
                    requestError,
                )

                setMenuError(
                    'Không thể tải danh sách món.',
                )
            } finally {
                if (
                    showFullLoading
                    && !signal?.aborted
                ) {
                    setIsLoadingMenu(false)
                }
            }
        },
        [],
    )

    // Initial load on mount
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadMenu()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadMenu])

    // WebSocket: refresh menu when backend broadcasts a waiter update
    useWaiterSocket(
        () => void loadMenu(undefined, false),
        () => void loadMenu(undefined, false),
    )

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

    const selectedItems =
        useMemo(
            () =>
                menu
                    .map((dish) => {
                        const draft =
                            orderDraft[dish.dishId] ?? {
                                qty: 0,
                                note: '',
                            }

                        if (draft.qty <= 0) {
                            return null
                        }

                        return {
                            ...dish,
                            qty: draft.qty,
                            note: draft.note,
                        }
                    })
                    .filter(Boolean) as Array<
                    MenuItemResponse & DraftItem
                >,
            [
                menu,
                orderDraft,
            ],
        )

    const orderTotal =
        selectedItems.reduce(
            (sum, item) =>
                sum + item.price * item.qty,
            0,
        )

    function openConfirm() {
        if (!tableIdNumber) {
            showToast(
                'Không xác định được bàn.',
                'error',
            )
            return
        }

        if (!selectedItems.length) {
            showToast(
                'Vui lòng chọn ít nhất 1 món',
                'error',
            )
            return
        }

        setShowConfirm(true)
    }

    async function submitCreateOrder() {
        if (!tableIdNumber) {
            showToast(
                'Không xác định được bàn.',
                'error',
            )
            return
        }

        const items: OrderItemRequest[] =
            selectedItems.map((item) => ({
                dishId: item.dishId,
                quantity: item.qty,
                note: item.note || '',
            }))

        const payload: CreateOrderRequest = {
            tableId: tableIdNumber,
            items,
        }

        setSubmitting(true)

        try {
            const response =
                reservationId
                    ? await waiterApi.createOrderFromReservation(
                        reservationId,
                        payload,
                    )
                    : await waiterApi.createOrder(payload)

            setSuccessData({
                message:
                    response.data.message
                    || 'Tạo đơn hàng thành công',
                itemSummary: '',
            })
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error(
                '[WAITER_CREATE_ORDER_SUBMIT_ERROR]',
                requestError,
            )

            showToast(
                getRequestErrorMessage(
                    requestError,
                    'Lỗi khi tạo đơn hàng',
                ),
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
        min = 0,
    ) {
        setOrderDraft((previous) => {
            const current =
                previous[dishId] ?? {
                    qty: 0,
                    note: '',
                }

            const qty =
                Math.max(
                    min,
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
        setOrderDraft((previous) => {
            const current =
                previous[dishId] ?? {
                    qty: 0,
                    note: '',
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

    return (
        <div className="waiter-container">
            <WaiterHeader />

            <main className="waiter-main">
                <div className="waiter-sub-header">
                    <BackArrow
                        onClick={() =>
                            navigate('/waiter/tables')
                        }
                    />

                    <h2 className="waiter-title">
                        Tạo đơn hàng - Bàn {tableIdNumber || '—'}
                    </h2>

                    <button
                        type="button"
                        className="waiter-action-btn"
                        disabled={
                            submitting
                            || isLoadingMenu
                            || !tableIdNumber
                        }
                        onClick={openConfirm}
                    >
                        Tạo đơn hàng
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

                {isLoadingMenu ? (
                    <div style={stateBoxStyle}>
                        Đang tải danh sách món...
                    </div>
                ) : menuError ? (
                    <div style={errorBoxStyle}>
                        <p>{menuError}</p>

                        <button
                            type="button"
                            className="waiter-action-btn"
                            onClick={() =>
                                void loadMenu(
                                    undefined,
                                    true,
                                )
                            }
                        >
                            Thử lại
                        </button>
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
                                            {isUnavailable && (
                                                <span className="waiter-badge waiter-badge-cancelled">
                                                    Hết hàng
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="waiter-qty-controls">
                                        <button
                                            type="button"
                                            className="waiter-qty-btn"
                                            disabled={draft.qty <= 0}
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
                                        placeholder="Ghi chú"
                                        value={draft.note}
                                        disabled={isUnavailable}
                                        className="waiter-note-input"
                                        onChange={(event) =>
                                            setDraftNote(
                                                dish.dishId,
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>

            {showConfirm && (
                <ConfirmModal
                    title="Xác nhận tạo đơn hàng"
                    message={`Bàn ${tableIdNumber} — ${selectedItems.length} món, tổng tạm tính ${fmtPrice(orderTotal)}`}
                    confirmLabel={
                        submitting
                            ? 'Đang tạo...'
                            : 'Xác nhận'
                    }
                    onCancel={() => {
                        if (!submitting) {
                            setShowConfirm(false)
                        }
                    }}
                    onConfirm={() => {
                        if (!submitting) {
                            void submitCreateOrder()
                        }
                    }}
                >
                    <ul className="waiter-confirm-list">
                        {selectedItems.map((item) => (
                            <li key={item.dishId}>
                                <span>
                                    {item.name} × {item.qty}
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

const stateBoxStyle: React.CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#64748b',
}

const errorBoxStyle: React.CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#dc2626',
}

const successSummaryStyle: React.CSSProperties = {
    marginTop: '1rem',
    whiteSpace: 'pre-wrap',
    color: '#475569',
}
