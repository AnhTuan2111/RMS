import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
} from 'react'
import {useNavigate} from 'react-router-dom'

import {
    adminApi,
    type AdminPaymentHistoryItem,
    type AdminPaymentMethod,
} from '@/shared/api/admin'
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from '@/shared/components/feedback'
import {
    PageCard,
    PageHeader,
} from '@/shared/components/ui'

const PAYMENT_HISTORY_PAGE_SIZE = 10
const PAYMENT_HISTORY_FILTER_DELAY_MS = 350

function formatCurrency(value: number) {
    return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

function formatPaymentDate(value: string) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function formatTableName(tableNumber: string) {
    if (!tableNumber) {
        return 'Mang về'
    }

    if (tableNumber.toLowerCase().startsWith('bàn')) {
        return tableNumber
    }

    return `Bàn ${tableNumber}`
}

function WalletIcon() {
    return (
        <svg
            aria-hidden="true"
            className="admin-payment-method-svg"
            focusable="false"
            viewBox="0 0 24 24"
        >
            <path d="M4.5 7.5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"/>
            <path d="M16.5 12h4v3h-4a1.5 1.5 0 0 1 0-3z"/>
            <path d="M5.5 7.5 15 4.8a1.8 1.8 0 0 1 2.2 1.3l.4 1.4"/>
        </svg>
    )
}

function QrIcon() {
    return (
        <svg
            aria-hidden="true"
            className="admin-payment-method-svg"
            focusable="false"
            viewBox="0 0 24 24"
        >
            <path d="M4 4h6v6H4z"/>
            <path d="M14 4h6v6h-6z"/>
            <path d="M4 14h6v6H4z"/>
            <path d="M14 14h2.5"/>
            <path d="M19 14h1"/>
            <path d="M14 17h6"/>
            <path d="M14 20h1.5"/>
            <path d="M18 20h2"/>
        </svg>
    )
}

function PaymentMethodBadge({
                                method,
                            }: {
    method: AdminPaymentMethod
}) {
    const isCash = method === 'CASH'

    return (
        <span
            className={
                isCash
                    ? 'admin-payment-method method-cash'
                    : 'admin-payment-method method-qrcode'
            }
        >
            <span className="admin-payment-method-icon">
                {isCash ? <WalletIcon/> : <QrIcon/>}
            </span>

            {method}
        </span>
    )
}

export default function AdminPaymentHistoryPage() {
    const navigate = useNavigate()
    const hasLoadedHistoryRef = useRef(false)

    const [payments, setPayments] =
        useState<AdminPaymentHistoryItem[]>([])

    const [page, setPage] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [tableFilter, setTableFilter] = useState('')
    const [methodFilter, setMethodFilter] = useState('ALL')
    const [keywordInput, setKeywordInput] = useState('')
    const [keywordFilter, setKeywordFilter] = useState('')



    const loadPaymentHistory = useCallback(
        async (
            targetPage: number,
            showFullLoading = true,
            signal?: AbortSignal,
        ) => {
            const filters = {
                tableNumber: tableFilter.trim() || undefined,
                paymentMethod:
                    methodFilter === 'ALL'
                        ? undefined
                        : methodFilter,
                keyword: keywordFilter.trim() || undefined,
            }

            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                let effectivePage = targetPage

                let {data} = await adminApi.getPaymentHistory(
                    effectivePage,
                    PAYMENT_HISTORY_PAGE_SIZE,
                    filters,
                    signal,
                )

                if (
                    data.totalPages > 0
                    && effectivePage > data.totalPages
                ) {
                    effectivePage = data.totalPages

                    const retryResponse =
                        await adminApi.getPaymentHistory(
                            effectivePage,
                            PAYMENT_HISTORY_PAGE_SIZE,
                            filters,
                            signal,
                        )

                    data = retryResponse.data
                }

                setPayments(data.items)
                setTotalItems(data.totalItems)
                setTotalPages(data.totalPages)
                setError(null)
                hasLoadedHistoryRef.current = true

                if (effectivePage !== targetPage) {
                    setPage(effectivePage)
                }
            } catch (requestError: unknown) {
                console.error(
                    '[ADMIN_PAYMENT_HISTORY_FETCH_ERROR]',
                    requestError,
                )

                setError(
                    'Không thể tải lịch sử thanh toán.',
                )
            } finally {
                if (showFullLoading) {
                    setIsLoading(false)
                }
            }
        },
        [
            tableFilter,
            methodFilter,
            keywordFilter,
        ],
    )

    useEffect(() => {
        const controller = new AbortController()
        const shouldShowFullLoading = !hasLoadedHistoryRef.current

        void loadPaymentHistory(
            page,
            shouldShowFullLoading,
            controller.signal,
        )

        return () => controller.abort()
    }, [loadPaymentHistory, page])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setKeywordFilter(keywordInput)
            setPage(1)
        }, PAYMENT_HISTORY_FILTER_DELAY_MS)

        return () => window.clearTimeout(timeoutId)
    }, [keywordInput])

    function handleFilterChange() {
        setPage(1)
    }

    function clearFilters() {
        setTableFilter('')
        setMethodFilter('ALL')
        setKeywordInput('')
        setKeywordFilter('')
        setPage(1)
    }

    function handlePageChange(nextPage: number) {
        const safeTotalPages = Math.max(totalPages, 1)

        const safeNextPage = Math.min(
            Math.max(nextPage, 1),
            safeTotalPages,
        )

        setPage(safeNextPage)
    }

    if (isLoading) {
        return (
            <LoadingState
                title="Đang tải lịch sử thanh toán..."
                description="Hệ thống đang lấy danh sách hóa đơn đã thanh toán."
            />
        )
    }

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    loadPaymentHistory(
                        page,
                        true,
                    ).catch((requestError) => {
                        console.error(requestError)
                    })
                }}
            />
        )
    }

    const firstVisibleItem =
        totalItems === 0
            ? 0
            : (page - 1) * PAYMENT_HISTORY_PAGE_SIZE + 1

    const lastVisibleItem = Math.min(
        page * PAYMENT_HISTORY_PAGE_SIZE,
        totalItems,
    )

    const safeTotalPages = Math.max(totalPages, 1)

    return (
        <div className="admin-payment-history-page">
            <PageCard className="admin-payment-header-card">
                <PageHeader
                    title="Lịch sử hóa đơn"
                    description={`${totalItems} hóa đơn đã thanh toán được ghi nhận`}
                    actions={
                        <button
                            aria-label="Quay lại"
                            className="admin-payment-back-button"
                            type="button"
                            onClick={() => navigate(-1)}
                        >
                            ‹
                        </button>
                    }
                />
            </PageCard>

            <PageCard>
                <div
                    style={{
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                    }}
                >
                    <select
                        value={tableFilter}
                        style={filterInputStyle}
                        onChange={(event) => {
                            setTableFilter(event.target.value)
                            handleFilterChange()
                        }}
                    >
                        <option value="">Tất cả bàn</option>
                        {Array.from({length: 12}, (_, i) =>
                            `T${String(i + 1).padStart(2, '0')}`,
                        ).map((tableNumber) => (
                            <option key={tableNumber} value={tableNumber}>
                                Bàn {tableNumber}
                            </option>
                        ))}
                    </select>

                    <select
                        value={methodFilter}
                        style={filterInputStyle}
                        onChange={(event) => {
                            setMethodFilter(event.target.value)
                            handleFilterChange()
                        }}
                    >
                        <option value="ALL">Tất cả phương thức</option>
                        <option value="CASH">Tiền mặt</option>
                        <option value="QRCODE">VNPay/QR</option>
                    </select>

                    <input
                        type="text"
                        value={keywordInput}
                        placeholder="Mã hóa đơn..."
                        style={{
                            ...filterInputStyle,
                            width: 140,
                        }}
                        onChange={(event) => {
                            setKeywordInput(event.target.value)
                        }}
                    />

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={clearFilters}
                    >
                        Xóa bộ lọc
                    </button>
                </div>
            </PageCard>

            <section className="admin-payment-table-card">
                <div className="admin-payment-table">
                    <div className="admin-payment-table-header">
                        <span>Mã hóa đơn</span>
                        <span>Mã đơn hàng</span>
                        <span>Bàn</span>
                        <span>Phương thức</span>
                        <span>Số tiền</span>
                        <span>Ngày thanh toán</span>
                        <span/>
                    </div>

                    {payments.length === 0 ? (
                        <EmptyState
                            title="Chưa có hóa đơn đã thanh toán"
                            description="Hiện hệ thống chưa ghi nhận hóa đơn thanh toán nào."
                        />
                    ) : (
                        payments.map((payment) => (
                            <button
                                className="admin-payment-table-row"
                                key={payment.invoiceId}
                                type="button"
                                onClick={() =>
                                    navigate(
                                        `/admin/invoices/${payment.invoiceId}`,
                                    )
                                }
                            >
                                <span className="admin-payment-id">
                                    {payment.invoiceId}
                                </span>

                                <span>
                                    {payment.orderId}
                                </span>

                                <span>
                                    {formatTableName(
                                        payment.tableNumber,
                                    )}
                                </span>

                                <span>
                                    <PaymentMethodBadge
                                        method={
                                            payment.paymentMethod
                                        }
                                    />
                                </span>

                                <span className="admin-payment-amount">
                                    {formatCurrency(payment.amount)}
                                </span>

                                <span>
                                    {formatPaymentDate(
                                        payment.paymentDate,
                                    )}
                                </span>

                                <span className="admin-payment-row-arrow">
                                    ›
                                </span>
                            </button>
                        ))
                    )}
                </div>

                {totalItems > 0 && (
                    <div className="admin-payment-pagination">
                        <div className="admin-payment-pagination-info">
                            Hiển thị {firstVisibleItem}-
                            {lastVisibleItem} trong tổng{' '}
                            {totalItems} hóa đơn
                        </div>

                        <div className="admin-payment-pagination-controls">
                            <button
                                className="admin-payment-pagination-button"
                                type="button"
                                disabled={page === 1}
                                onClick={() =>
                                    handlePageChange(page - 1)
                                }
                            >
                                Trước
                            </button>

                            <span className="admin-payment-pagination-page">
                                Trang {page} / {safeTotalPages}
                            </span>

                            <button
                                className="admin-payment-pagination-button"
                                type="button"
                                disabled={
                                    totalPages === 0
                                    || page >= totalPages
                                }
                                onClick={() =>
                                    handlePageChange(page + 1)
                                }
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )

}
const filterInputStyle: CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 13,
}
