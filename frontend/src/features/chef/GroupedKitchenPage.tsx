import {useCallback, useEffect, useMemo, useState} from 'react'
import {Link} from 'react-router-dom'

import {
    completeGroupedKitchenOrders,
    getGroupedKitchenOrders,
    type GroupedKitchenOrderResponse,
} from '@/shared/api/chef'
import {useKitchenSocket} from '@/realtime'
import {EmptyState, ErrorState, LoadingState} from '@/shared/components/feedback'
import {PageCard, PageHeader} from '@/shared/components/ui'

const ITEMS_PER_PAGE = 6

type GroupFilter = 'ALL' | 'GROUPABLE' | 'WITH_NOTE'

type SortOrder = 'OLDEST' | 'NEWEST' | 'QUANTITY_DESC'

function getTimeValue(value?: string) {
    if (!value) {
        return 0
    }

    const time = new Date(value).getTime()

    return Number.isNaN(time) ? 0 : time
}

function getWaitingMinutes(value?: string) {
    const createdTime = getTimeValue(value)

    if (!createdTime) {
        return 0
    }

    return Math.max(0, Math.floor((Date.now() - createdTime) / 60_000))
}

function getWaitingClass(minutes: number) {
    if (minutes >= 15) {
        return 'danger'
    }

    if (minutes >= 10) {
        return 'warning'
    }

    return 'normal'
}

export default function GroupedKitchenPage() {
    const [groups, setGroups] = useState<GroupedKitchenOrderResponse[]>([])

    const [searchText, setSearchText] = useState('')

    const [selectedTable, setSelectedTable] = useState('ALL')

    const [groupFilter, setGroupFilter] = useState<GroupFilter>('ALL')

    const [sortOrder, setSortOrder] = useState<SortOrder>('OLDEST')

    const [currentPage, setCurrentPage] = useState(1)

    const [completingGroupKey, setCompletingGroupKey] = useState<string | null>(null)

    const [isLoading, setIsLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const loadGroups = useCallback(
        async (showFullLoading: boolean, resetPage: boolean, signal?: AbortSignal) => {
            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                const data = await getGroupedKitchenOrders(signal)

                setGroups(data)
                setError(null)

                if (resetPage) {
                    setCurrentPage(1)
                }
            } catch (requestError) {
                if (signal?.aborted) {
                    return
                }

                console.error('[CHEF_GROUPED_ORDERS_FETCH_ERROR]', requestError)

                setError('Không thể tải danh sách gom món.')
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
            void loadGroups(true, false)
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadGroups])

    // WebSocket: refresh when backend broadcasts a kitchen update
    useKitchenSocket(() => void loadGroups(false, false))

    async function handleCompleteGroup(group: GroupedKitchenOrderResponse) {
        const confirmed = window.confirm(
            group.hasNote
                ? `Xác nhận hoàn thành món ` + `"${group.dishName}"?`
                : `Xác nhận hoàn thành cả nhóm ` +
                      `"${group.dishName}" ` +
                      `với tổng số lượng ` +
                      `${group.totalQuantity}?`,
        )

        if (!confirmed) {
            return
        }

        try {
            setCompletingGroupKey(group.groupKey)

            await completeGroupedKitchenOrders(
                group.items.map((item) => item.orderItemId),
            )

            await loadGroups(false, true)
        } catch (requestError) {
            console.error(requestError)

            alert('Không thể hoàn thành nhóm món.')
        } finally {
            setCompletingGroupKey(null)
        }
    }

    function clearFilters() {
        setSearchText('')
        setSelectedTable('ALL')
        setGroupFilter('ALL')
        setSortOrder('OLDEST')
        setCurrentPage(1)
    }

    const tableNumbers = useMemo(() => {
        return Array.from(
            new Set(
                groups.flatMap((group) => group.items.map((item) => item.tableNumber)),
            ),
        ).sort((first, second) => first.localeCompare(second, 'vi', {numeric: true}))
    }, [groups])

    const filteredGroups = useMemo(() => {
        const keyword = searchText.trim().toLowerCase()

        return [...groups]
            .filter((group) => {
                const matchesSearch =
                    keyword === '' ||
                    group.dishName.toLowerCase().includes(keyword) ||
                    (group.note ?? '').toLowerCase().includes(keyword) ||
                    group.items.some(
                        (item) =>
                            item.tableNumber.toLowerCase().includes(keyword) ||
                            String(item.orderId).includes(keyword) ||
                            String(item.orderItemId).includes(keyword),
                    )

                const matchesTable =
                    selectedTable === 'ALL' ||
                    group.items.some((item) => item.tableNumber === selectedTable)

                const matchesType =
                    groupFilter === 'ALL' ||
                    (groupFilter === 'GROUPABLE' && !group.hasNote) ||
                    (groupFilter === 'WITH_NOTE' && group.hasNote)

                return matchesSearch && matchesTable && matchesType
            })
            .sort((first, second) => {
                if (sortOrder === 'QUANTITY_DESC') {
                    return second.totalQuantity - first.totalQuantity
                }

                const firstTime = getTimeValue(first.earliestCreatedAt)

                const secondTime = getTimeValue(second.earliestCreatedAt)

                if (sortOrder === 'NEWEST') {
                    return secondTime - firstTime
                }

                if (firstTime !== secondTime) {
                    return firstTime - secondTime
                }

                if (first.hasNote !== second.hasNote) {
                    return first.hasNote ? -1 : 1
                }

                if (first.totalQuantity !== second.totalQuantity) {
                    return second.totalQuantity - first.totalQuantity
                }

                return first.dishName.localeCompare(second.dishName, 'vi')
            })
    }, [groups, searchText, selectedTable, groupFilter, sortOrder])

    const totalPages = Math.max(1, Math.ceil(filteredGroups.length / ITEMS_PER_PAGE))

    const safeCurrentPage = Math.min(currentPage, totalPages)

    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE

    const paginatedGroups = filteredGroups.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    const firstVisibleItem = filteredGroups.length === 0 ? 0 : startIndex + 1

    const lastVisibleItem = Math.min(startIndex + ITEMS_PER_PAGE, filteredGroups.length)

    const visiblePageNumbers = useMemo(() => {
        const maximumVisiblePages = 5

        if (totalPages <= maximumVisiblePages) {
            return Array.from({length: totalPages}, (_, index) => index + 1)
        }

        let startPage = Math.max(1, safeCurrentPage - 2)

        const endPage = Math.min(totalPages, startPage + maximumVisiblePages - 1)

        if (endPage - startPage + 1 < maximumVisiblePages) {
            startPage = Math.max(1, endPage - maximumVisiblePages + 1)
        }

        return Array.from(
            {length: endPage - startPage + 1},
            (_, index) => startPage + index,
        )
    }, [safeCurrentPage, totalPages])

    function handlePageChange(page: number) {
        const nextPage = Math.min(Math.max(page, 1), totalPages)

        setCurrentPage(nextPage)

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        })
    }

    if (isLoading) {
        return (
            <LoadingState
                title="Đang tải danh sách gom món..."
                description="Hệ thống đang lấy dữ liệu nhóm món mới nhất từ bếp."
            />
        )
    }

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    loadGroups(true, true).catch((requestError) => {
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
                    title="Gom món để nấu"
                    description="Món giống nhau và không có ghi chú được gom thành một nhóm. Món có ghi chú luôn được tách riêng."
                    actions={
                        <div className="chef-summary">
                            <div>
                                <strong>{groups.length}</strong>
                                <span>Nhóm cần nấu</span>
                            </div>

                            <div>
                                <strong>
                                    {groups.reduce(
                                        (total, group) => total + group.totalQuantity,
                                        0,
                                    )}
                                </strong>
                                <span>Tổng số phần</span>
                            </div>

                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                    loadGroups(true, true).catch((requestError) => {
                                        console.error(requestError)
                                    })
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
                        placeholder={'Tìm món, bàn, ' + 'mã đơn hoặc ghi chú...'}
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
                        value={groupFilter}
                        onChange={(event) => {
                            const nextFilter = event.target.value as GroupFilter

                            setGroupFilter(nextFilter)
                            setCurrentPage(1)
                        }}
                    >
                        <option value="ALL">Tất cả nhóm</option>

                        <option value="GROUPABLE">Có thể nấu chung</option>

                        <option value="WITH_NOTE">Có ghi chú</option>
                    </select>

                    <select
                        value={sortOrder}
                        onChange={(event) => {
                            const nextSortOrder = event.target.value as SortOrder

                            setSortOrder(nextSortOrder)
                            setCurrentPage(1)
                        }}
                    >
                        <option value="OLDEST">Chờ lâu nhất</option>

                        <option value="NEWEST">Mới nhất</option>

                        <option value="QUANTITY_DESC">Số lượng lớn nhất</option>
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

            {filteredGroups.length === 0 ? (
                <EmptyState
                    title="Không có nhóm món phù hợp"
                    description="Hãy thay đổi từ khóa hoặc bộ lọc."
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
                    <div className="grouped-kitchen-grid">
                        {paginatedGroups.map((group) => {
                            const waitingMinutes = getWaitingMinutes(
                                group.earliestCreatedAt,
                            )

                            const waitingClass = getWaitingClass(waitingMinutes)

                            return (
                                <article
                                    className={
                                        group.hasNote
                                            ? 'grouped-kitchen-card has-note'
                                            : 'grouped-kitchen-card'
                                    }
                                    key={group.groupKey}
                                >
                                    <div className="grouped-card-head">
                                        <div>
                                            <span
                                                className={
                                                    group.hasNote
                                                        ? 'group-type note'
                                                        : 'group-type batch'
                                                }
                                            >
                                                {group.hasNote
                                                    ? 'CÓ GHI CHÚ — LÀM RIÊNG'
                                                    : 'GOM CHUNG'}
                                            </span>

                                            <h3>{group.dishName}</h3>

                                            <p>
                                                {group.items.length} order item ·{' '}
                                                {
                                                    new Set(
                                                        group.items.map(
                                                            (item) => item.tableNumber,
                                                        ),
                                                    ).size
                                                }{' '}
                                                bàn
                                            </p>
                                        </div>

                                        <div className="group-total">
                                            <small>TỔNG</small>
                                            <strong>x{group.totalQuantity}</strong>
                                        </div>
                                    </div>

                                    <div className={`waiting-badge ` + waitingClass}>
                                        Chờ {waitingMinutes} phút
                                    </div>

                                    {group.hasNote && (
                                        <div className="group-note">
                                            <strong>Ghi chú:</strong> {group.note}
                                        </div>
                                    )}

                                    <div className="group-item-list">
                                        {group.items.map((item) => (
                                            <div
                                                className={
                                                    item.tableNumber === selectedTable
                                                        ? 'group-item-row highlighted'
                                                        : 'group-item-row'
                                                }
                                                key={item.orderItemId}
                                            >
                                                <span>
                                                    <strong>
                                                        Bàn {item.tableNumber}
                                                    </strong>

                                                    <small>
                                                        Order #{item.orderId}
                                                        {' · '}
                                                        Item #{item.orderItemId}
                                                    </small>
                                                </span>

                                                <b>x{item.quantity}</b>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="group-card-footer">
                                        <Link
                                            className="group-detail-link"
                                            to="/chef/orders"
                                        >
                                            Xem từng đơn
                                        </Link>

                                        <button
                                            type="button"
                                            className="primary-button"
                                            disabled={
                                                completingGroupKey === group.groupKey
                                            }
                                            onClick={() => {
                                                handleCompleteGroup(group).catch(
                                                    (requestError) => {
                                                        console.error(requestError)
                                                    },
                                                )
                                            }}
                                        >
                                            {completingGroupKey === group.groupKey
                                                ? 'Đang cập nhật...'
                                                : group.hasNote
                                                  ? 'Xong món'
                                                  : 'Xong cả nhóm'}
                                        </button>
                                    </div>
                                </article>
                            )
                        })}
                    </div>

                    <div className="chef-pagination">
                        <div className="pagination-result-info">
                            Hiển thị <strong>{firstVisibleItem}</strong>–
                            <strong>{lastVisibleItem}</strong> trong{' '}
                            <strong>{filteredGroups.length}</strong> nhóm món
                        </div>

                        <div className="pagination-controls">
                            <button
                                type="button"
                                className="pagination-button"
                                disabled={safeCurrentPage === 1}
                                onClick={() => handlePageChange(safeCurrentPage - 1)}
                            >
                                ← Trang trước
                            </button>

                            <div className="pagination-pages">
                                {visiblePageNumbers[0] > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            className="pagination-number"
                                            onClick={() => handlePageChange(1)}
                                        >
                                            1
                                        </button>

                                        {visiblePageNumbers[0] > 2 && (
                                            <span className="pagination-ellipsis">…</span>
                                        )}
                                    </>
                                )}

                                {visiblePageNumbers.map((pageNumber) => (
                                    <button
                                        type="button"
                                        key={pageNumber}
                                        className={
                                            pageNumber === safeCurrentPage
                                                ? 'pagination-number active'
                                                : 'pagination-number'
                                        }
                                        onClick={() => handlePageChange(pageNumber)}
                                    >
                                        {pageNumber}
                                    </button>
                                ))}

                                {visiblePageNumbers[visiblePageNumbers.length - 1] <
                                    totalPages && (
                                    <>
                                        {visiblePageNumbers[
                                            visiblePageNumbers.length - 1
                                        ] <
                                            totalPages - 1 && (
                                            <span className="pagination-ellipsis">…</span>
                                        )}

                                        <button
                                            type="button"
                                            className="pagination-number"
                                            onClick={() => handlePageChange(totalPages)}
                                        >
                                            {totalPages}
                                        </button>
                                    </>
                                )}
                            </div>

                            <button
                                type="button"
                                className="pagination-button"
                                disabled={safeCurrentPage === totalPages}
                                onClick={() => handlePageChange(safeCurrentPage + 1)}
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
