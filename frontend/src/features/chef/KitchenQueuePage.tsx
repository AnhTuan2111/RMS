import {EmptyState, ErrorState, LoadingState} from '@/shared/components/feedback'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useKitchenSocket} from '@/realtime'

import {
    getDishDetail,
    getKitchenOrders,
    cancelDish,
    updateOrderItemStatus,
    updateChefInternalNote,
    type DishDetailResponse,
    type KitchenOrderItemResponse,
} from '@/shared/api/chef'

const ITEMS_PER_PAGE = 6
const NEW_ORDER_MESSAGE_DURATION_MS = 6_000

type BrowserWindow = Window & {
    webkitAudioContext?: typeof AudioContext
}

function createAudioContext(): AudioContext | null {
    const AudioContextClass =
        window.AudioContext || (window as BrowserWindow).webkitAudioContext

    return AudioContextClass ? new AudioContextClass() : null
}

type SortOrder = 'OLDEST' | 'NEWEST'

function formatTime(value?: string) {
    if (!value) {
        return '—'
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

export default function KitchenQueuePage() {
    const [items, setItems] = useState<KitchenOrderItemResponse[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [searchText, setSearchText] = useState('')
    const [selectedTable, setSelectedTable] = useState('ALL')
    const [sortOrder, setSortOrder] = useState<SortOrder>('OLDEST')
    const [currentPage, setCurrentPage] = useState(1)

    const [selectedDish, setSelectedDish] = useState<DishDetailResponse | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)

    const [completingItemId, setCompletingItemId] = useState<number | null>(null)

    const [cancelReason, setCancelReason] = useState('')
    const [cancelError, setCancelError] = useState<string | null>(null)
    const [isCancelSubmitting, setIsCancelSubmitting] = useState(false)

    const [chefInternalNote, setChefInternalNote] = useState('')

    const [internalNoteError, setInternalNoteError] = useState<string | null>(null)

    const [isInternalNoteSubmitting, setIsInternalNoteSubmitting] = useState(false)

    const [isSoundEnabled, setIsSoundEnabled] = useState(false)

    const [newOrderMessage, setNewOrderMessage] = useState<string | null>(null)

    const audioContextRef = useRef<AudioContext | null>(null)

    const isSoundEnabledRef = useRef(false)

    const knownOrderItemIdsRef = useRef<Set<number>>(new Set())

    const hasLoadedInitialOrdersRef = useRef(false)

    const newOrderMessageTimerRef = useRef<number | null>(null)

    const originalDocumentTitleRef = useRef(document.title)

    const playNewOrderSound = useCallback(() => {
        const audioContext = audioContextRef.current

        if (
            !isSoundEnabledRef.current ||
            !audioContext ||
            audioContext.state !== 'running'
        ) {
            return
        }

        const startTime = audioContext.currentTime

        const tones = [
            {
                frequency: 880,
                startOffset: 0,
                duration: 0.14,
            },
            {
                frequency: 1175,
                startOffset: 0.18,
                duration: 0.18,
            },
            {
                frequency: 1320,
                startOffset: 0.4,
                duration: 0.22,
            },
        ]

        tones.forEach((tone) => {
            const oscillator = audioContext.createOscillator()

            const gain = audioContext.createGain()

            oscillator.type = 'sine'

            oscillator.frequency.setValueAtTime(
                tone.frequency,
                startTime + tone.startOffset,
            )

            gain.gain.setValueAtTime(0.0001, startTime + tone.startOffset)

            gain.gain.exponentialRampToValueAtTime(
                0.18,
                startTime + tone.startOffset + 0.02,
            )

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                startTime + tone.startOffset + tone.duration,
            )

            oscillator.connect(gain)
            gain.connect(audioContext.destination)

            oscillator.start(startTime + tone.startOffset)

            oscillator.stop(startTime + tone.startOffset + tone.duration)
        })
    }, [])

    const showNewOrderMessage = useCallback((newOrderCount: number) => {
        const message =
            newOrderCount === 1
                ? 'Có 1 món mới vừa được gửi vào bếp.'
                : `Có ${newOrderCount} món mới vừa được gửi vào bếp.`

        setNewOrderMessage(message)

        document.title =
            `🔔 ${newOrderCount} món mới - ` + originalDocumentTitleRef.current

        if (newOrderMessageTimerRef.current !== null) {
            window.clearTimeout(newOrderMessageTimerRef.current)
        }

        newOrderMessageTimerRef.current = window.setTimeout(() => {
            setNewOrderMessage(null)

            document.title = originalDocumentTitleRef.current

            newOrderMessageTimerRef.current = null
        }, NEW_ORDER_MESSAGE_DURATION_MS)
    }, [])

    const fetchKitchenOrders = useCallback(
        async (showFullLoading: boolean, resetPage: boolean, signal?: AbortSignal) => {
            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                const data = await getKitchenOrders(signal)

                if (hasLoadedInitialOrdersRef.current) {
                    const newItems = data.filter(
                        (item) => !knownOrderItemIdsRef.current.has(item.orderItemId),
                    )

                    if (newItems.length > 0) {
                        playNewOrderSound()

                        showNewOrderMessage(newItems.length)
                    }
                }

                knownOrderItemIdsRef.current = new Set(
                    data.map((item) => item.orderItemId),
                )

                hasLoadedInitialOrdersRef.current = true

                setItems(data)
                setError(null)

                if (resetPage) {
                    setCurrentPage(1)
                }
            } catch (requestError) {
                if (signal?.aborted) {
                    return
                }

                console.error('[CHEF_KITCHEN_QUEUE_FETCH_ERROR]', requestError)

                setError(
                    'Không thể tải danh sách món cần chế biến. Hãy kiểm tra backend hoặc đăng nhập bằng tài khoản Chef.',
                )
            } finally {
                if (showFullLoading) {
                    setIsLoading(false)
                }
            }
        },
        [playNewOrderSound, showNewOrderMessage],
    )

    useEffect(() => {
        const originalTitle = originalDocumentTitleRef.current

        return () => {
            if (newOrderMessageTimerRef.current !== null) {
                window.clearTimeout(newOrderMessageTimerRef.current)
            }

            document.title = originalTitle

            audioContextRef.current?.close().catch((requestError) => {
                console.error('[CHEF_AUDIO_CONTEXT_CLOSE_ERROR]', requestError)
            })

            audioContextRef.current = null
        }
    }, [])

    // Initial load on mount
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchKitchenOrders(true, false)
        }, 0)

        return () => window.clearTimeout(timer)
    }, [fetchKitchenOrders])

    // WebSocket: refresh when backend broadcasts a kitchen update
    useKitchenSocket(() => {
        void fetchKitchenOrders(false, false)

        // Nếu đang mở modal chi tiết, refetch để cập nhật trạng thái ghi chú/hủy...
        if (selectedDish) {
            getDishDetail(selectedDish.orderItemId)
                .then(setSelectedDish)
                .catch((requestError) => {
                    console.error(requestError)
                })
        }
    })

    async function loadKitchenOrders() {
        await fetchKitchenOrders(true, true)
    }

    async function handleSoundToggle() {
        if (isSoundEnabled) {
            isSoundEnabledRef.current = false
            setIsSoundEnabled(false)

            await audioContextRef.current?.close()

            audioContextRef.current = null

            return
        }

        const audioContext = audioContextRef.current ?? createAudioContext()

        if (!audioContext) {
            alert('Trình duyệt này không hỗ trợ phát âm thanh.')

            return
        }

        audioContextRef.current = audioContext

        if (audioContext.state === 'suspended') {
            await audioContext.resume()
        }

        isSoundEnabledRef.current = true
        setIsSoundEnabled(true)

        const oscillator = audioContext.createOscillator()

        const gain = audioContext.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.value = 880
        gain.gain.value = 0.08

        oscillator.connect(gain)
        gain.connect(audioContext.destination)

        oscillator.start()

        window.setTimeout(() => {
            oscillator.stop()
        }, 120)
    }

    async function openDishDetail(orderItemId: number) {
        try {
            setIsDetailLoading(true)
            setDetailError(null)
            setSelectedDish(null)
            setCancelReason('')
            setCancelError(null)

            const data = await getDishDetail(orderItemId)

            setSelectedDish(data)
            setChefInternalNote(data.chefInternalNote ?? '')
            setInternalNoteError(null)
        } catch (requestError) {
            console.error(requestError)
            setDetailError('Không thể tải chi tiết món.')
        } finally {
            setIsDetailLoading(false)
        }
    }

    function closeDishDetail() {
        setSelectedDish(null)
        setDetailError(null)
        setIsDetailLoading(false)
        setCancelReason('')
        setCancelError(null)
        setIsCancelSubmitting(false)
        setChefInternalNote('')
        setInternalNoteError(null)
        setIsInternalNoteSubmitting(false)
    }

    async function handleSaveInternalNote() {
        if (!selectedDish) {
            return
        }

        const normalizedNote = chefInternalNote.trim()

        if (normalizedNote.length > 500) {
            setInternalNoteError('Ghi chú nội bộ không được vượt quá 500 ký tự.')
            return
        }

        const confirmed = window.confirm(
            normalizedNote
                ? 'Gửi ghi chú nội bộ này cho Waiter?'
                : 'Xóa ghi chú nội bộ hiện tại?',
        )

        if (!confirmed) {
            return
        }

        try {
            setIsInternalNoteSubmitting(true)
            setInternalNoteError(null)

            const updatedDetail = await updateChefInternalNote(
                selectedDish.orderItemId,
                normalizedNote,
            )

            setSelectedDish(updatedDetail)
            setChefInternalNote(updatedDetail.chefInternalNote ?? '')

            alert(
                normalizedNote
                    ? 'Đã gửi ghi chú nội bộ cho Waiter.'
                    : 'Đã xóa ghi chú nội bộ.',
            )
        } catch (requestError) {
            console.error(requestError)
            setInternalNoteError('Không thể lưu ghi chú nội bộ.')
        } finally {
            setIsInternalNoteSubmitting(false)
        }
    }

    async function handleComplete(orderItemId: number) {
        const currentItem = items.find((item) => item.orderItemId === orderItemId)

        const dishName =
            selectedDish?.orderItemId === orderItemId
                ? selectedDish.dishName
                : (currentItem?.dishName ?? 'món này')

        const tableNumber =
            selectedDish?.orderItemId === orderItemId
                ? selectedDish.tableNumber
                : currentItem?.tableNumber

        const quantity =
            selectedDish?.orderItemId === orderItemId
                ? selectedDish.quantity
                : currentItem?.quantity

        const confirmed = window.confirm(
            `Xác nhận hoàn thành món "${dishName}"?\n\n` +
                `${tableNumber ? `Bàn: ${tableNumber}\n` : ''}` +
                `${quantity ? `Số lượng: x${quantity}\n` : ''}` +
                'Sau khi xác nhận, món sẽ được chuyển ' +
                'sang danh sách đã hoàn thành.',
        )

        if (!confirmed) {
            return
        }

        try {
            setCompletingItemId(orderItemId)

            await updateOrderItemStatus(orderItemId, 'COMPLETED')

            setItems((currentItems) =>
                currentItems.filter((item) => item.orderItemId !== orderItemId),
            )

            if (selectedDish?.orderItemId === orderItemId) {
                closeDishDetail()
            }

            alert('Đã hoàn thành món thành công.')
        } catch (requestError) {
            console.error(requestError)
            alert('Không thể cập nhật trạng thái món.')
        } finally {
            setCompletingItemId(null)
        }
    }

    async function handleCancelDish() {
        if (!selectedDish) {
            return
        }

        const normalizedReason = cancelReason.trim()

        if (!normalizedReason) {
            setCancelError('Vui lòng nhập lý do hủy món.')
            return
        }

        if (normalizedReason.length > 500) {
            setCancelError('Lý do hủy không được vượt quá 500 ký tự.')
            return
        }

        const confirmed = window.confirm(
            `Bạn có chắc muốn hủy món "${selectedDish.dishName}"?\n\n` +
                'Món sẽ bị hủy ngay và Waiter sẽ được thông báo.',
        )

        if (!confirmed) {
            return
        }

        try {
            setIsCancelSubmitting(true)
            setCancelError(null)

            const cancelledOrderItemId = selectedDish.orderItemId

            await cancelDish(cancelledOrderItemId, normalizedReason)

            /*
             * Hủy từ modal chỉ xóa đúng OrderItem
             * đang được chọn khỏi hàng đợi.
             */
            setItems((currentItems) =>
                currentItems.filter((item) => item.orderItemId !== cancelledOrderItemId),
            )

            closeDishDetail()

            alert('Đã hủy món thành công.')
        } catch (requestError) {
            console.error(requestError)
            setCancelError('Không thể hủy món.')
        } finally {
            setIsCancelSubmitting(false)
        }
    }

    function clearFilters() {
        setSearchText('')
        setSelectedTable('ALL')
        setSortOrder('OLDEST')
        setCurrentPage(1)
    }

    const tableNumbers = useMemo<string[]>(() => {
        return Array.from(new Set(items.map((item) => item.tableNumber))).sort(
            (firstTable, secondTable) =>
                firstTable.localeCompare(secondTable, 'vi', {numeric: true}),
        )
    }, [items])

    const filteredItems = useMemo(() => {
        const keyword = searchText.trim().toLowerCase()

        return [...items]
            .filter((item) => {
                const matchesSearch =
                    keyword === '' ||
                    item.dishName.toLowerCase().includes(keyword) ||
                    item.tableNumber.toLowerCase().includes(keyword) ||
                    String(item.orderId).includes(keyword) ||
                    String(item.orderItemId).includes(keyword)

                const matchesTable =
                    selectedTable === 'ALL' || item.tableNumber === selectedTable

                return matchesSearch && matchesTable
            })
            .sort((firstItem, secondItem) => {
                const firstTime = firstItem.createdAt
                    ? new Date(firstItem.createdAt).getTime()
                    : 0

                const secondTime = secondItem.createdAt
                    ? new Date(secondItem.createdAt).getTime()
                    : 0

                return sortOrder === 'OLDEST'
                    ? firstTime - secondTime
                    : secondTime - firstTime
            })
    }, [items, searchText, selectedTable, sortOrder])

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE))

    const safeCurrentPage = Math.min(currentPage, totalPages)

    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE

    const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    const firstVisibleItem = filteredItems.length === 0 ? 0 : startIndex + 1

    const lastVisibleItem = Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)

    if (isLoading) {
        return (
            <LoadingState
                title="Đang tải danh sách món cần chế biến..."
                description="Hệ thống đang lấy dữ liệu mới nhất từ bếp."
            />
        )
    }

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    loadKitchenOrders().catch((requestError) => {
                        console.error(requestError)
                    })
                }}
            />
        )
    }

    return (
        <div className="chef-page">
            <section className="page-card">
                <div className="page-header">
                    <div>
                        <h2>Đơn cần chế biến</h2>
                        <p>Chọn món để xem chi tiết, hoàn thành món hoặc hủy món.</p>
                    </div>

                    <div className="chef-summary">
                        <div>
                            <strong>{items.length}</strong>
                            <span>Đang chờ làm</span>
                        </div>

                        <button
                            type="button"
                            aria-pressed={isSoundEnabled}
                            title={
                                isSoundEnabled
                                    ? 'Tắt chuông báo món mới'
                                    : 'Bật chuông báo món mới'
                            }
                            className={
                                isSoundEnabled
                                    ? 'secondary-button sound-toggle-button enabled'
                                    : 'secondary-button sound-toggle-button'
                            }
                            onClick={() => {
                                handleSoundToggle().catch((requestError) => {
                                    console.error(requestError)
                                })
                            }}
                        >
                            {isSoundEnabled ? '🔊 Âm thanh đang bật' : '🔇 Bật âm thanh'}
                        </button>

                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                                loadKitchenOrders().catch((requestError) => {
                                    console.error(requestError)
                                })
                            }}
                        >
                            Làm mới
                        </button>
                    </div>
                </div>
            </section>

            {newOrderMessage && (
                <div className="new-order-notification" role="status" aria-live="polite">
                    <span className="new-order-notification-icon">🔔</span>

                    <div>
                        <strong>Đơn mới</strong>
                        <p>{newOrderMessage}</p>
                    </div>
                </div>
            )}

            <section className="page-card">
                <div className="chef-filter-bar">
                    <input
                        type="search"
                        value={searchText}
                        placeholder="Tìm tên món, bàn hoặc mã đơn..."
                        onChange={(event) => {
                            setSearchText(event.target.value)
                            setCurrentPage(1)
                        }}
                    />

                    <select
                        value={selectedTable}
                        onChange={(event) => {
                            setSelectedTable(event.target.value)
                            setCurrentPage(1)
                        }}
                    >
                        <option value="ALL">Tất cả bàn</option>

                        {tableNumbers.map((tableNumber) => (
                            <option key={tableNumber} value={tableNumber}>
                                Bàn {tableNumber}
                            </option>
                        ))}
                    </select>

                    <select
                        value={sortOrder}
                        onChange={(event) => {
                            setSortOrder(event.target.value as SortOrder)
                            setCurrentPage(1)
                        }}
                    >
                        <option value="OLDEST">Cũ nhất trước</option>

                        <option value="NEWEST">Mới nhất trước</option>
                    </select>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={clearFilters}
                    >
                        Xóa bộ lọc
                    </button>
                </div>
            </section>

            {filteredItems.length === 0 ? (
                <EmptyState
                    title="Không tìm thấy món phù hợp"
                    description="Hãy thay đổi từ khóa hoặc xóa bộ lọc."
                    action={
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={clearFilters}
                        >
                            Xóa bộ lọc
                        </button>
                    }
                />
            ) : (
                <>
                    <div className="kitchen-board">
                        {paginatedItems.map((item) => (
                            <section
                                className="kitchen-order-card clickable-card"
                                key={item.orderItemId}
                                onClick={() => {
                                    openDishDetail(item.orderItemId).catch(
                                        (requestError) => {
                                            console.error(requestError)
                                        },
                                    )
                                }}
                            >
                                <div className="kitchen-order-header">
                                    <div>
                                        <h3>Bàn {item.tableNumber}</h3>

                                        <p>
                                            Order #{item.orderId} · Item #
                                            {item.orderItemId} ·{' '}
                                            {formatTime(item.createdAt)}
                                        </p>
                                    </div>

                                    <span className="status-badge preparing">
                                        Đang làm
                                    </span>
                                </div>

                                <div className="kitchen-item-list">
                                    <div className="kitchen-item">
                                        <div>
                                            <strong>{item.dishName}</strong>

                                            <p>Số lượng: x{item.quantity}</p>

                                            <small>Chọn để xem chi tiết</small>
                                        </div>

                                        <div className="kitchen-item-actions">
                                            <button
                                                type="button"
                                                className="primary-button"
                                                disabled={
                                                    completingItemId === item.orderItemId
                                                }
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    handleComplete(
                                                        item.orderItemId,
                                                    ).catch((requestError) => {
                                                        console.error(requestError)
                                                    })
                                                }}
                                            >
                                                {completingItemId === item.orderItemId
                                                    ? 'Đang cập nhật...'
                                                    : 'Xong món'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        ))}
                    </div>

                    <div className="chef-pagination">
                        <div className="pagination-result-info">
                            Hiển thị {firstVisibleItem}–{lastVisibleItem} trong{' '}
                            {filteredItems.length} món
                        </div>

                        <div className="pagination-controls">
                            <button
                                type="button"
                                className="pagination-button"
                                disabled={safeCurrentPage === 1}
                                onClick={() => setCurrentPage(safeCurrentPage - 1)}
                            >
                                ← Trang trước
                            </button>

                            <div className="pagination-pages">
                                {Array.from(
                                    {length: totalPages},
                                    (_, index) => index + 1,
                                ).map((pageNumber) => (
                                    <button
                                        type="button"
                                        key={pageNumber}
                                        className={
                                            pageNumber === safeCurrentPage
                                                ? 'pagination-number active'
                                                : 'pagination-number'
                                        }
                                        onClick={() => setCurrentPage(pageNumber)}
                                    >
                                        {pageNumber}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                className="pagination-button"
                                disabled={safeCurrentPage === totalPages}
                                onClick={() => setCurrentPage(safeCurrentPage + 1)}
                            >
                                Trang sau →
                            </button>
                        </div>
                    </div>
                </>
            )}

            {(isDetailLoading || detailError || selectedDish) && (
                <div className="modal-backdrop" onClick={closeDishDetail}>
                    <div
                        className="modal-card"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div>
                                <h2>Chi tiết món cần chế biến</h2>
                                <p>Thông tin chi tiết từ bếp.</p>
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                onClick={closeDishDetail}
                            >
                                ×
                            </button>
                        </div>

                        {isDetailLoading && (
                            <div className="modal-body">
                                <p>Đang tải chi tiết món...</p>
                            </div>
                        )}

                        {detailError && (
                            <div className="modal-body">
                                <p className="modal-error">{detailError}</p>
                            </div>
                        )}

                        {selectedDish && (
                            <>
                                <div className="modal-body">
                                    <div className="detail-grid">
                                        <div>
                                            <span>Bàn</span>
                                            <strong>{selectedDish.tableNumber}</strong>
                                        </div>

                                        <div>
                                            <span>Mã item</span>
                                            <strong>#{selectedDish.orderItemId}</strong>
                                        </div>

                                        <div>
                                            <span>Tên món</span>
                                            <strong>{selectedDish.dishName}</strong>
                                        </div>

                                        <div>
                                            <span>Số lượng</span>
                                            <strong>x{selectedDish.quantity}</strong>
                                        </div>

                                        <div>
                                            <span>Trạng thái</span>
                                            <strong>{selectedDish.status}</strong>
                                        </div>

                                        <div>
                                            <span>Thời gian</span>
                                            <strong>
                                                {formatTime(selectedDish.createdAt)}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="detail-section">
                                        <h3>Mô tả món</h3>
                                        <p>
                                            {selectedDish.description ||
                                                'Không có mô tả.'}
                                        </p>
                                    </div>

                                    <div className="detail-section">
                                        <h3>Ghi chú</h3>
                                        <p>{selectedDish.note || 'Không có ghi chú.'}</p>
                                    </div>

                                    <div className="chef-internal-note-box">
                                        <div className="chef-internal-note-heading">
                                            <div>
                                                <h3>Ghi chú nội bộ cho Waiter</h3>

                                                <p>
                                                    Dùng để báo tình trạng bếp trước khi
                                                    Waiter trao đổi với khách.
                                                </p>
                                            </div>

                                            {selectedDish.chefInternalNote && (
                                                <span
                                                    className={
                                                        selectedDish.chefInternalNoteAcknowledgedAt
                                                            ? 'internal-note-status acknowledged'
                                                            : 'internal-note-status waiting'
                                                    }
                                                >
                                                    {selectedDish.chefInternalNoteAcknowledgedAt
                                                        ? 'Waiter đã xem'
                                                        : 'Chờ Waiter xem'}
                                                </span>
                                            )}
                                        </div>

                                        <div className="internal-note-quick-actions">
                                            {[
                                                'Hết sốt, vui lòng hỏi khách đổi lựa chọn.',
                                                'Món sẽ chậm thêm khoảng 10 phút.',
                                                'Món này hiện chỉ còn 1 phần.',
                                                'Có thể phục vụ nhưng thiếu phần trang trí.',
                                            ].map((quickNote) => (
                                                <button
                                                    type="button"
                                                    key={quickNote}
                                                    onClick={() => {
                                                        setChefInternalNote(quickNote)
                                                        setInternalNoteError(null)
                                                    }}
                                                >
                                                    {quickNote}
                                                </button>
                                            ))}
                                        </div>

                                        <textarea
                                            rows={4}
                                            maxLength={500}
                                            value={chefInternalNote}
                                            placeholder="Ví dụ: Hết sốt tiêu đen, vui lòng hỏi khách đổi sang sốt nấm."
                                            onChange={(event) => {
                                                setChefInternalNote(event.target.value)
                                                setInternalNoteError(null)
                                            }}
                                        />

                                        <div className="internal-note-bottom-row">
                                            <span>{chefInternalNote.length}/500</span>

                                            <button
                                                type="button"
                                                className="secondary-button internal-note-save-button"
                                                disabled={isInternalNoteSubmitting}
                                                onClick={() =>
                                                    handleSaveInternalNote().catch(
                                                        (requestError) => {
                                                            console.error(requestError)
                                                        },
                                                    )
                                                }
                                            >
                                                {isInternalNoteSubmitting
                                                    ? 'Đang gửi...'
                                                    : chefInternalNote.trim()
                                                      ? 'Gửi cho Waiter'
                                                      : 'Xóa ghi chú'}
                                            </button>
                                        </div>

                                        {internalNoteError && (
                                            <p className="modal-error">
                                                {internalNoteError}
                                            </p>
                                        )}
                                    </div>

                                    <div className="cancel-request-box">
                                        <h3>Hủy món</h3>

                                        <p>
                                            Món sẽ bị hủy ngay. Waiter chỉ nhận thông báo
                                            để báo lại với khách.
                                        </p>

                                        <textarea
                                            rows={4}
                                            maxLength={500}
                                            value={cancelReason}
                                            placeholder="Nhập lý do hủy món..."
                                            onChange={(event) => {
                                                setCancelReason(event.target.value)
                                                setCancelError(null)
                                            }}
                                        />

                                        <div className="cancel-reason-count">
                                            {cancelReason.length}/500
                                        </div>

                                        {cancelError && (
                                            <p className="modal-error">{cancelError}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={closeDishDetail}
                                    >
                                        Quay lại
                                    </button>

                                    <button
                                        type="button"
                                        className="danger-button"
                                        disabled={isCancelSubmitting}
                                        onClick={() =>
                                            handleCancelDish().catch((requestError) => {
                                                console.error(requestError)
                                            })
                                        }
                                    >
                                        {isCancelSubmitting ? 'Đang hủy...' : 'Hủy món'}
                                    </button>

                                    <button
                                        type="button"
                                        className="primary-button"
                                        disabled={
                                            completingItemId === selectedDish.orderItemId
                                        }
                                        onClick={() =>
                                            handleComplete(
                                                selectedDish.orderItemId,
                                            ).catch((requestError) => {
                                                console.error(requestError)
                                            })
                                        }
                                    >
                                        {completingItemId === selectedDish.orderItemId
                                            ? 'Đang cập nhật...'
                                            : 'Xong món'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
