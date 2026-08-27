import {useCallback, useEffect, useMemo, useState} from 'react'
import {Link, useSearchParams} from 'react-router-dom'

import {getChefDishes, updateMenuStatus, type DishListResponse} from '@/shared/api/chef'
import {EmptyState, ErrorState, LoadingState} from '@/shared/components/feedback'
import {PageCard, PageHeader} from '@/shared/components/ui'
import {useKitchenSocket} from '@/realtime'

const ITEMS_PER_PAGE = 8

type StatusFilter = 'ALL' | 'AVAILABLE' | 'UNAVAILABLE'

type SortOrder = 'NAME_ASC' | 'NAME_DESC' | 'PRICE_ASC' | 'PRICE_DESC'

function formatCurrency(value: number) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(value)
}

export default function DishListPage() {
    const [searchParams] = useSearchParams()

    const routeStatus = searchParams.get('status')

    const initialStatus: StatusFilter =
        routeStatus === 'unavailable' ? 'UNAVAILABLE' : 'ALL'

    const [dishes, setDishes] = useState<DishListResponse[]>([])

    const [isLoading, setIsLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const [searchText, setSearchText] = useState('')

    const [selectedCategory, setSelectedCategory] = useState('ALL')

    const [selectedStatus, setSelectedStatus] = useState<StatusFilter>(initialStatus)

    const [sortOrder, setSortOrder] = useState<SortOrder>('NAME_ASC')

    const [currentPage, setCurrentPage] = useState(1)

    const [updatingDishId, setUpdatingDishId] = useState<number | null>(null)

    const loadDishes = useCallback(
        async (showFullLoading: boolean, resetPage: boolean, signal?: AbortSignal) => {
            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                const data = await getChefDishes(signal)

                setDishes(data)
                setError(null)

                if (resetPage) {
                    setCurrentPage(1)
                }
            } catch (requestError) {
                if (signal?.aborted) {
                    return
                }

                console.error('[CHEF_DISH_LIST_FETCH_ERROR]', requestError)

                setError('Không thể tải danh sách món ăn.')
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
            void loadDishes(true, false)
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadDishes])

    // WebSocket: refresh when backend broadcasts a kitchen update
    useKitchenSocket(() => void loadDishes(false, false))

    async function handleToggleDish(dish: DishListResponse) {
        const nextAvailable = !dish.available

        if (
            dish.available &&
            !window.confirm(
                `Đặt "${dish.dishName}" thành tạm hết?\n` +
                    'Các món này đang chờ trong bếp ' +
                    'sẽ được chuyển sang CANCELLED.',
            )
        ) {
            return
        }

        try {
            setUpdatingDishId(dish.dishId)

            await updateMenuStatus(dish.dishId, nextAvailable)

            setDishes((currentDishes) =>
                currentDishes.map((item) =>
                    item.dishId === dish.dishId
                        ? {
                              ...item,
                              available: nextAvailable,
                          }
                        : item,
                ),
            )
        } catch (requestError) {
            console.error(requestError)

            alert('Không thể cập nhật trạng thái món.')
        } finally {
            setUpdatingDishId(null)
        }
    }

    function clearFilters() {
        setSearchText('')
        setSelectedCategory('ALL')
        setSelectedStatus('ALL')
        setSortOrder('NAME_ASC')
        setCurrentPage(1)
    }

    const availableCount = useMemo(() => {
        return dishes.filter((dishItem) => dishItem.available).length
    }, [dishes])

    const unavailableCount = useMemo(() => {
        return dishes.filter((dishItem) => !dishItem.available).length
    }, [dishes])

    const categories = useMemo(() => {
        return Array.from(
            new Set(dishes.map((dishItem) => dishItem.category).filter(Boolean)),
        ).sort((firstCategory, secondCategory) =>
            firstCategory.localeCompare(secondCategory, 'vi'),
        )
    }, [dishes])

    const filteredDishes = useMemo(() => {
        const keyword = searchText.trim().toLowerCase()

        return [...dishes]
            .filter((dishItem) => {
                const matchesSearch =
                    keyword === '' ||
                    dishItem.dishName.toLowerCase().includes(keyword) ||
                    dishItem.category.toLowerCase().includes(keyword) ||
                    String(dishItem.dishId).includes(keyword)

                const matchesCategory =
                    selectedCategory === 'ALL' || dishItem.category === selectedCategory

                const matchesStatus =
                    selectedStatus === 'ALL' ||
                    (selectedStatus === 'AVAILABLE' && dishItem.available) ||
                    (selectedStatus === 'UNAVAILABLE' && !dishItem.available)

                return matchesSearch && matchesCategory && matchesStatus
            })
            .sort((firstDish, secondDish) => {
                switch (sortOrder) {
                    case 'NAME_DESC':
                        return secondDish.dishName.localeCompare(firstDish.dishName, 'vi')

                    case 'PRICE_ASC':
                        return firstDish.price - secondDish.price

                    case 'PRICE_DESC':
                        return secondDish.price - firstDish.price

                    case 'NAME_ASC':
                    default:
                        return firstDish.dishName.localeCompare(secondDish.dishName, 'vi')
                }
            })
    }, [dishes, searchText, selectedCategory, selectedStatus, sortOrder])

    const totalPages = Math.max(1, Math.ceil(filteredDishes.length / ITEMS_PER_PAGE))

    const safeCurrentPage = Math.min(currentPage, totalPages)

    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE

    const paginatedDishes = filteredDishes.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    const firstVisibleItem = filteredDishes.length === 0 ? 0 : startIndex + 1

    const lastVisibleItem = Math.min(startIndex + ITEMS_PER_PAGE, filteredDishes.length)

    const showUnavailableOnly = selectedStatus === 'UNAVAILABLE'

    if (isLoading) {
        return (
            <LoadingState
                title="Đang tải danh sách món ăn..."
                description="Hệ thống đang lấy dữ liệu thực đơn mới nhất."
            />
        )
    }

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    loadDishes(true, true).catch((requestError) => {
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
                    title={showUnavailableOnly ? 'Món đang tạm hết' : 'Quản lý món ăn'}
                    description="Tìm kiếm, lọc và thay đổi trạng thái phục vụ của thực đơn."
                    actions={
                        <div className="chef-summary">
                            <div>
                                <strong>{availableCount}</strong>

                                <span>Đang bán</span>
                            </div>

                            <div>
                                <strong>{unavailableCount}</strong>

                                <span>Tạm hết</span>
                            </div>

                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                    loadDishes(true, true).catch((requestError) => {
                                        console.error(requestError)
                                    })
                                }}
                            >
                                Làm mới
                            </button>
                        </div>
                    }
                />

                {routeStatus === 'unavailable' && (
                    <Link className="secondary-button" to="/chef/dishes">
                        ← Xem tất cả món
                    </Link>
                )}
            </PageCard>

            <PageCard>
                <div className="chef-filter-bar">
                    <input
                        type="search"
                        value={searchText}
                        placeholder="Tìm tên món, danh mục hoặc mã món..."
                        onChange={(event) => {
                            setSearchText(event.target.value)
                            setCurrentPage(1)
                        }}
                    />

                    <select
                        value={selectedCategory}
                        onChange={(event) => {
                            setSelectedCategory(event.target.value)
                            setCurrentPage(1)
                        }}
                    >
                        <option value="ALL">Tất cả danh mục</option>

                        {categories.map((category) => (
                            <option key={category} value={category}>
                                {category}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedStatus}
                        onChange={(event) => {
                            setSelectedStatus(event.target.value as StatusFilter)
                            setCurrentPage(1)
                        }}
                    >
                        <option value="ALL">Tất cả trạng thái</option>

                        <option value="AVAILABLE">Đang bán</option>

                        <option value="UNAVAILABLE">Tạm hết</option>
                    </select>

                    <select
                        value={sortOrder}
                        onChange={(event) => {
                            setSortOrder(event.target.value as SortOrder)
                            setCurrentPage(1)
                        }}
                    >
                        <option value="NAME_ASC">Tên A → Z</option>

                        <option value="NAME_DESC">Tên Z → A</option>

                        <option value="PRICE_ASC">Giá thấp → cao</option>

                        <option value="PRICE_DESC">Giá cao → thấp</option>
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

            {filteredDishes.length === 0 ? (
                <EmptyState
                    title="Không tìm thấy món phù hợp"
                    description="Hãy thay đổi điều kiện lọc hoặc xóa bộ lọc."
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
                        <div className="simple-table chef-dish-table">
                            <div className="simple-table-header">
                                <span>Tên món</span>
                                <span>Danh mục</span>
                                <span>Giá bán</span>
                                <span>Trạng thái</span>
                                <span>Thao tác</span>
                            </div>

                            {paginatedDishes.map((dishItem) => (
                                <div className="simple-table-row" key={dishItem.dishId}>
                                    <span className="dish-name-cell">
                                        <strong>{dishItem.dishName}</strong>
                                    </span>

                                    <span>
                                        <span className="category-pill">
                                            {dishItem.category}
                                        </span>
                                    </span>

                                    <span className="dish-price">
                                        {formatCurrency(dishItem.price)}
                                    </span>

                                    <span>
                                        <span
                                            className={
                                                dishItem.available
                                                    ? 'status-badge completed'
                                                    : 'status-badge danger'
                                            }
                                        >
                                            {dishItem.available ? 'Đang bán' : 'Tạm hết'}
                                        </span>
                                    </span>

                                    <span>
                                        <button
                                            type="button"
                                            disabled={updatingDishId === dishItem.dishId}
                                            className={
                                                dishItem.available
                                                    ? 'secondary-button'
                                                    : 'primary-button'
                                            }
                                            onClick={() => {
                                                handleToggleDish(dishItem).catch(
                                                    (requestError) => {
                                                        console.error(requestError)
                                                    },
                                                )
                                            }}
                                        >
                                            {updatingDishId === dishItem.dishId
                                                ? 'Đang cập nhật...'
                                                : dishItem.available
                                                  ? 'Tạm hết'
                                                  : 'Mở bán'}
                                        </button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </PageCard>

                    <div className="chef-pagination">
                        <div className="pagination-result-info">
                            Hiển thị {firstVisibleItem}–{lastVisibleItem} trong{' '}
                            {filteredDishes.length} món
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
                                {Array.from(
                                    {
                                        length: totalPages,
                                    },
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
                                        onClick={() => {
                                            setCurrentPage(pageNumber)
                                        }}
                                    >
                                        {pageNumber}
                                    </button>
                                ))}
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
