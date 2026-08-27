import {useCallback, useEffect, useMemo, useState} from 'react'

import {getCompletedOrders, type KitchenOrderItemResponse} from '@/shared/api/chef'
import {useKitchenSocket} from '@/realtime'
import {EmptyState, ErrorState, LoadingState} from '@/shared/components/feedback'
import {PageCard, PageHeader} from '@/shared/components/ui'

const ITEMS_PER_PAGE = 20

type SortOrder = 'NEWEST' | 'OLDEST'

function formatDateTime(value?: string) {
    if (!value) {
        return '—'
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

export default function CompletedOrdersPage() {
    const [items, setItems] = useState<KitchenOrderItemResponse[]>([])

    const [isLoading, setIsLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const [searchText, setSearchText] = useState('')

    const [selectedTable, setSelectedTable] = useState('ALL')

    const [sortOrder, setSortOrder] = useState<SortOrder>('NEWEST')

    const [currentPage, setCurrentPage] = useState(1)

    const loadCompletedOrders = useCallback(
        async (showFullLoading: boolean, resetPage: boolean, signal?: AbortSignal) => {
            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                const data = await getCompletedOrders(signal)

                setItems(data)
                setError(null)

                if (resetPage) {
                    setCurrentPage(1)
                }
            } catch (requestError) {
                if (signal?.aborted) {
                    return
                }

                console.error('[CHEF_COMPLETED_ORDERS_FETCH_ERROR]', requestError)

                setError('Không thể tải danh sách món đã hoàn thành.')
            } finally {
                if (showFullLoading) {
                    setIsLoading(false)
                }
            }
        },
        [],
    )

    // Initial load on mount
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadCompletedOrders(true, false)
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadCompletedOrders])

    // WebSocket: refresh when backend broadcasts a kitchen update
    useKitchenSocket(() => void loadCompletedOrders(false, false))

    function clearFilters() {
        setSearchText('')
        setSelectedTable('ALL')
        setSortOrder('NEWEST')
        setCurrentPage(1)
    }

    const tableNumbers = useMemo(() => {
        return Array.from(
            new Set(items.map((item) => item.tableNumber).filter(Boolean)),
        ).sort((firstTable, secondTable) =>
            firstTable.localeCompare(secondTable, 'vi', {numeric: true}),
        )
    }, [items])

    const filteredItems = useMemo(() => {
        const keyword = searchText.trim().toLowerCase()

        return [...items]
            .filter((item) => {
                const dishName = item.dishName?.toLowerCase() ?? ''

                const tableNumber = item.tableNumber?.toLowerCase() ?? ''

                const matchesSearch =
                    keyword === '' ||
                    dishName.includes(keyword) ||
                    tableNumber.includes(keyword) ||
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

    const pageNumbersToShow = useMemo(() => {
        const pages: (number | 'ellipsis')[] = []
        const siblingCount = 1 // số trang hiển thị mỗi bên trang hiện tại

        const totalNumbersShown = siblingCount * 2 + 5 // first, last, current, 2 ellipsis

        if (totalPages <= totalNumbersShown) {
            for (let page = 1; page <= totalPages; page++) {
                pages.push(page)
            }
            return pages
        }

        const leftSibling = Math.max(safeCurrentPage - siblingCount, 1)
        const rightSibling = Math.min(safeCurrentPage + siblingCount, totalPages)

        const showLeftEllipsis = leftSibling > 2
        const showRightEllipsis = rightSibling < totalPages - 1

        pages.push(1)

        if (showLeftEllipsis) {
            pages.push('ellipsis')
        } else {
            for (let page = 2; page < leftSibling; page++) {
                pages.push(page)
            }
        }

        for (let page = leftSibling; page <= rightSibling; page++) {
            if (page !== 1 && page !== totalPages) {
                pages.push(page)
            }
        }

        if (showRightEllipsis) {
            pages.push('ellipsis')
        } else {
            for (let page = rightSibling + 1; page < totalPages; page++) {
                pages.push(page)
            }
        }

        pages.push(totalPages)

        return pages
    }, [totalPages, safeCurrentPage])

    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE

    const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    const firstVisibleItem = filteredItems.length === 0 ? 0 : startIndex + 1

    const lastVisibleItem = Math.min(startIndex + ITEMS_PER_PAGE, filteredItems.length)

    if (isLoading) {
        return (
            <LoadingState
                title="Đang tải danh sách món đã hoàn thành..."
                description="Hệ thống đang lấy dữ liệu mới nhất từ bếp."
            />
        )
    }

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    loadCompletedOrders(true, true).catch((requestError) => {
                        console.error(requestError)
                    })
                }}
            />
        )
    }

    return (
        <div className="chef-page">
            <PageCard>
                <PageHeader
                    title="Món đã hoàn thành hôm nay"
                    description="Chỉ hiển thị món hoàn thành trong ngày hôm nay. Tìm theo tên món, bàn, mã đơn hoặc mã item."
                    actions={
                        <div className="chef-summary">
                            <div>
                                <strong>{items.length}</strong>
                                <span>Đã hoàn thành hôm nay</span>
                            </div>

                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                    loadCompletedOrders(true, true).catch(
                                        (requestError) => {
                                            console.error(requestError)
                                        },
                                    )
                                }}
                            >
                                Làm mới
                            </button>
                        </div>
                    }
                />
            </PageCard>

            <PageCard>
                <div className="chef-filter-bar">
                    <input
                        type="search"
                        value={searchText}
                        placeholder="Tìm tên món, bàn, mã đơn hoặc mã item..."
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
                        <option value="NEWEST">Mới nhất trước</option>

                        <option value="OLDEST">Cũ nhất trước</option>
                    </select>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={clearFilters}
                    >
                        Xóa bộ lọc
                    </button>
                </div>
            </PageCard>

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
                    <PageCard>
                        <div className="completed-orders-list">
                            {paginatedItems.map((item) => (
                                <article
                                    className="completed-order-card"
                                    key={item.orderItemId}
                                >
                                    <div className="completed-order-main">
                                        <div>
                                            <span className="completed-order-id">
                                                Order #{item.orderId}
                                                {' · '}
                                                Item #{item.orderItemId}
                                            </span>

                                            <h3>{item.dishName}</h3>
                                        </div>

                                        <span className="status-badge completed">
                                            Hoàn thành
                                        </span>
                                    </div>

                                    <div className="completed-order-info">
                                        <div>
                                            <small>BÀN</small>

                                            <strong>{item.tableNumber}</strong>
                                        </div>

                                        <div>
                                            <small>SỐ LƯỢNG</small>

                                            <strong>x{item.quantity}</strong>
                                        </div>

                                        <div>
                                            <small>THỜI GIAN TẠO</small>

                                            <strong>
                                                {formatDateTime(item.createdAt)}
                                            </strong>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </PageCard>

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
                                onClick={() => {
                                    setCurrentPage(safeCurrentPage - 1)
                                }}
                            >
                                ← Trang trước
                            </button>

                            <div className="pagination-pages">
                                {pageNumbersToShow.map((pageNumber, index) =>
                                    pageNumber === 'ellipsis' ? (
                                        <span
                                            key={`ellipsis-${index}`}
                                            className="pagination-ellipsis"
                                        >
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            key={pageNumber}
                                            className={
                                                pageNumber === safeCurrentPage
                                                    ? 'pagination-number active'
                                                    : 'pagination-number'
                                            }
                                            onClick={() => {
                                                setCurrentPage(pageNumber)
                                            }}
                                        >
                                            {pageNumber}
                                        </button>
                                    ),
                                )}
                            </div>

                            <button
                                type="button"
                                className="pagination-button"
                                disabled={safeCurrentPage === totalPages}
                                onClick={() => {
                                    setCurrentPage(safeCurrentPage + 1)
                                }}
                            >
                                Trang sau →
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
