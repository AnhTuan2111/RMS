import {useCallback, useRef, useState, type CSSProperties} from 'react'

import {cashierApi} from '@/shared/api/cashier'
import type {InvoiceDetail, InvoiceSummary} from '@/shared/types/cashier'
import {REALTIME_CONFIG} from '@/app/config/realtime'
import {EmptyState, ErrorState, LoadingState} from '@/shared/components/feedback'
import {PageCard, PageHeader} from '@/shared/components/ui'
import {usePolling} from '@/shared/hooks/usePolling'

const PAGE_SIZE = 10

type InvoiceFilterParams = {
    page: number
    tableNumber: string
    keyword: string
    paymentMethod: string
    invoiceCode: string
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

function formatTime(iso: string) {
    const date = new Date(iso)

    if (Number.isNaN(date.getTime())) {
        return iso
    }

    return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

function methodLabel(method: string | null) {
    if (method === 'CASH') {
        return 'Tiền mặt'
    }

    if (method === 'QRCODE') {
        return 'VNPay/QR'
    }

    return '—'
}

export default function CashierInvoicesPage() {
    const [invoices, setInvoices] = useState<InvoiceSummary[]>([])

    const [totalPages, setTotalPages] = useState(0)

    const [totalElements, setTotalElements] = useState(0)

    const [page, setPage] = useState(0)

    const [isLoading, setIsLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const [tableNumber, setTableNumber] = useState('')

    const [keyword, setKeyword] = useState('')

    const [paymentMethod, setPaymentMethod] = useState('')

    const [invoiceCode, setInvoiceCode] = useState('')

    const [tableOptions, setTableOptions] = useState<string[]>([])

    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)

    const [loadingDetail, setLoadingDetail] = useState(false)

    const hasLoadedInitialInvoicesRef = useRef(false)

    const loadInvoices = useCallback(
        async (
            showFullLoading = true,
            signal?: AbortSignal,
            override?: Partial<InvoiceFilterParams>,
        ) => {
            const nextParams: InvoiceFilterParams = {
                page,
                tableNumber,
                keyword,
                paymentMethod,
                invoiceCode,
                ...override,
            }

            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                setError(null)

                const [tableResponse, invoiceResponse] = await Promise.all([
                    cashierApi.getTables(signal),
                    cashierApi.getTodayInvoices(
                        {
                            page: nextParams.page,
                            size: PAGE_SIZE,
                            tableNumber: nextParams.tableNumber || undefined,
                            keyword: nextParams.keyword || undefined,
                            paymentMethod: nextParams.paymentMethod || undefined,
                            invoiceCode: nextParams.invoiceCode || undefined,
                        },
                        signal,
                    ),
                ])

                if (signal?.aborted) {
                    return
                }

                setTableOptions(tableResponse.data.map((table) => table.tableNumber))

                setInvoices(invoiceResponse.data.content)
                setTotalPages(invoiceResponse.data.totalPages)
                setTotalElements(invoiceResponse.data.totalElements)
                setError(null)
            } catch (requestError: unknown) {
                if (signal?.aborted || isRequestCanceled(requestError)) {
                    return
                }

                console.error('[CASHIER_INVOICES_FETCH_ERROR]', requestError)

                setError('Không thể tải danh sách hóa đơn.')
            } finally {
                if (showFullLoading && !signal?.aborted) {
                    setIsLoading(false)
                }
            }
        },
        [page, tableNumber, keyword, paymentMethod, invoiceCode],
    )

    usePolling(
        async (signal) => {
            const isInitialLoad = !hasLoadedInitialInvoicesRef.current

            await loadInvoices(isInitialLoad, signal)

            hasLoadedInitialInvoicesRef.current = true
        },
        {
            intervalMs: REALTIME_CONFIG.cashier.invoicesIntervalMs,

            runImmediately: true,
            pauseWhenHidden: true,

            onError: (requestError) => {
                console.error('[CASHIER_INVOICES_POLL_ERROR]', requestError)
            },
        },
    )

    function handleTableNumberChange(value: string) {
        setTableNumber(value)
        setPage(0)

        void loadInvoices(true, undefined, {
            page: 0,
            tableNumber: value,
        })
    }

    function handleKeywordChange(value: string) {
        setKeyword(value)
        setPage(0)

        void loadInvoices(true, undefined, {
            page: 0,
            keyword: value,
        })
    }

    function handlePaymentMethodChange(value: string) {
        setPaymentMethod(value)
        setPage(0)

        void loadInvoices(true, undefined, {
            page: 0,
            paymentMethod: value,
        })
    }

    function handleInvoiceCodeChange(value: string) {
        setInvoiceCode(value)
        setPage(0)

        void loadInvoices(true, undefined, {
            page: 0,
            invoiceCode: value,
        })
    }

    function handlePageChange(nextPage: number) {
        const safeTotalPages = Math.max(totalPages, 1)

        const safeNextPage = Math.min(Math.max(nextPage, 0), safeTotalPages - 1)

        setPage(safeNextPage)

        void loadInvoices(true, undefined, {
            page: safeNextPage,
        })
    }

    async function openDetail(invoiceId: number) {
        setLoadingDetail(true)

        try {
            const response = await cashierApi.getInvoiceDetail(invoiceId)

            setSelectedInvoice(response.data)
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[CASHIER_INVOICE_DETAIL_ERROR]', requestError)

            alert('Không thể tải chi tiết hóa đơn.')
        } finally {
            setLoadingDetail(false)
        }
    }

    async function handleDownloadPdf(invoiceId: number) {
        try {
            const response = await cashierApi.downloadInvoicePdf(invoiceId)

            const blob = new Blob([response.data as BlobPart], {
                type: 'application/pdf',
            })

            const url = window.URL.createObjectURL(blob)

            const link = document.createElement('a')

            link.href = url
            link.setAttribute('download', `Invoice-${invoiceId}.pdf`)

            document.body.appendChild(link)
            link.click()
            link.remove()

            window.URL.revokeObjectURL(url)
        } catch (requestError: unknown) {
            if (isRequestCanceled(requestError)) {
                return
            }

            console.error('[CASHIER_INVOICE_PDF_ERROR]', requestError)

            alert('Không thể tải PDF!')
        }
    }

    const safeTotalPages = Math.max(totalPages, 1)

    return (
        <PageCard>
            <PageHeader
                title="Hóa đơn hôm nay"
                description={`Danh sách hóa đơn đã thanh toán trong ngày (${totalElements} hóa đơn)`}
            />

            <div
                style={{
                    display: 'flex',
                    gap: 10,
                    marginBottom: 16,
                    flexWrap: 'wrap',
                }}
            >
                <select
                    value={tableNumber}
                    style={filterInputStyle}
                    onChange={(event) => handleTableNumberChange(event.target.value)}
                >
                    <option value="">Tất cả bàn</option>

                    {tableOptions.map((table) => (
                        <option key={table} value={table}>
                            {table}
                        </option>
                    ))}
                </select>

                <input
                    value={keyword}
                    placeholder="Tìm theo tên/SĐT khách hàng..."
                    style={{
                        ...filterInputStyle,
                        flex: 1,
                        minWidth: 200,
                    }}
                    onChange={(event) => handleKeywordChange(event.target.value)}
                />

                <select
                    value={paymentMethod}
                    style={filterInputStyle}
                    onChange={(event) => handlePaymentMethodChange(event.target.value)}
                >
                    <option value="">Tất cả phương thức</option>
                    <option value="CASH">Tiền mặt</option>
                    <option value="QRCODE">VNPay/QR</option>
                </select>

                <input
                    value={invoiceCode}
                    placeholder="Mã hóa đơn..."
                    style={{
                        ...filterInputStyle,
                        width: 140,
                    }}
                    onChange={(event) => handleInvoiceCodeChange(event.target.value)}
                />
            </div>

            {error && (
                <ErrorState message={error} onRetry={() => void loadInvoices(true)} />
            )}

            {isLoading ? (
                <LoadingState
                    title="Đang tải lịch sử hóa đơn..."
                    description="Hệ thống đang lấy danh sách hóa đơn mới nhất."
                />
            ) : invoices.length === 0 ? (
                <EmptyState
                    title="Không có hóa đơn"
                    description="Không có hóa đơn nào khớp bộ lọc hiện tại."
                />
            ) : (
                <div className="simple-table">
                    <div className="simple-table-header" style={gridCols}>
                        <span>Mã HĐ</span>
                        <span>Bàn</span>
                        <span>Giờ</span>
                        <span>Khách hàng</span>
                        <span>Tổng tiền</span>
                        <span>Phương thức</span>
                        <span>Thao tác</span>
                    </div>

                    {invoices.map((invoice) => (
                        <div
                            className="simple-table-row"
                            key={invoice.invoiceId}
                            style={{
                                ...gridCols,
                                alignItems: 'center',
                            }}
                        >
                            <span
                                style={{
                                    fontWeight: 600,
                                }}
                            >
                                INV-{invoice.invoiceId}
                            </span>

                            <span>{invoice.tableNumber}</span>

                            <span>{formatTime(invoice.invoiceDate)}</span>

                            <span
                                style={{
                                    color: '#6b7280',
                                    fontSize: 13,
                                }}
                            >
                                {invoice.customerName ?? '—'}
                            </span>

                            <span
                                style={{
                                    fontWeight: 600,
                                    color: '#b91c1c',
                                }}
                            >
                                {invoice.finalAmount.toLocaleString()} đ
                            </span>

                            <span>
                                <span
                                    style={{
                                        background:
                                            invoice.paymentMethod === 'CASH'
                                                ? '#d1fae5'
                                                : '#dbeafe',
                                        color:
                                            invoice.paymentMethod === 'CASH'
                                                ? '#065f46'
                                                : '#1e40af',
                                        padding: '2px 8px',
                                        borderRadius: 12,
                                        fontSize: 11,
                                        fontWeight: 600,
                                    }}
                                >
                                    {methodLabel(invoice.paymentMethod)}
                                </span>
                            </span>

                            <span>
                                <button
                                    type="button"
                                    style={btn('#f3f4f6', '#374151')}
                                    onClick={() => void openDetail(invoice.invoiceId)}
                                >
                                    Xem chi tiết
                                </button>
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 20,
                        alignItems: 'center',
                    }}
                >
                    <button
                        type="button"
                        disabled={page === 0}
                        style={btn('#f3f4f6', '#374151')}
                        onClick={() => handlePageChange(page - 1)}
                    >
                        ← Trước
                    </button>

                    <span
                        style={{
                            fontSize: 13,
                            color: '#6b7280',
                        }}
                    >
                        Trang {page + 1} / {safeTotalPages}
                    </span>

                    <button
                        type="button"
                        disabled={page >= totalPages - 1}
                        style={btn('#f3f4f6', '#374151')}
                        onClick={() => handlePageChange(page + 1)}
                    >
                        Sau →
                    </button>
                </div>
            )}

            {(selectedInvoice || loadingDetail) && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 14,
                            padding: 28,
                            width: 480,
                            maxWidth: '92vw',
                            maxHeight: '85vh',
                            overflowY: 'auto',
                            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
                        }}
                    >
                        {loadingDetail || !selectedInvoice ? (
                            <p
                                style={{
                                    textAlign: 'center',
                                    padding: 40,
                                }}
                            >
                                Đang tải chi tiết...
                            </p>
                        ) : (
                            <>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: 16,
                                    }}
                                >
                                    <h3
                                        style={{
                                            margin: 0,
                                        }}
                                    >
                                        Hóa đơn INV-{selectedInvoice.invoiceId}
                                    </h3>

                                    <button
                                        type="button"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            fontSize: 22,
                                            cursor: 'pointer',
                                            color: '#9ca3af',
                                        }}
                                        onClick={() => setSelectedInvoice(null)}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div
                                    style={{
                                        fontSize: 13,
                                        color: '#64748b',
                                        marginBottom: 12,
                                    }}
                                >
                                    Bàn: <strong>{selectedInvoice.tableNumber}</strong>
                                    {' · '}
                                    Giờ:{' '}
                                    <strong>
                                        {formatTime(selectedInvoice.invoiceDate)}
                                    </strong>
                                </div>

                                <div
                                    className="simple-table"
                                    style={{
                                        marginBottom: 16,
                                        minWidth: 0,
                                    }}
                                >
                                    <div
                                        className="simple-table-header"
                                        style={{
                                            gridTemplateColumns:
                                                'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
                                            display: 'grid',
                                            fontWeight: 'bold',
                                            borderBottom: '1px solid #cbd5e1',
                                            paddingBottom: '8px',
                                            minWidth: 0,
                                        }}
                                    >
                                        <span>Món ăn</span>
                                        <span>SL</span>
                                        <span
                                            style={{
                                                textAlign: 'right',
                                            }}
                                        >
                                            Thành tiền
                                        </span>
                                    </div>

                                    {selectedInvoice.items.map((item, index) => (
                                        <div
                                            key={`${item.dishName}-${index}`}
                                            style={{
                                                gridTemplateColumns: '2fr 1fr 1fr',
                                                display: 'grid',
                                                padding: '6px 0',
                                                borderBottom: '1px dashed #f1f5f9',
                                            }}
                                        >
                                            <span>{item.dishName}</span>
                                            <span>x{item.quantity}</span>
                                            <span
                                                style={{
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {item.subTotal.toLocaleString()} đ
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div
                                    style={{
                                        background: '#f8fafc',
                                        padding: 12,
                                        borderRadius: 8,
                                        marginBottom: 16,
                                        fontSize: 14,
                                    }}
                                >
                                    <Row
                                        label="Tạm tính:"
                                        value={`${selectedInvoice.totalBeforeVat.toLocaleString()} đ`}
                                    />
                                    <Row
                                        label="VAT (10%):"
                                        value={`${selectedInvoice.vatAmount.toLocaleString()} đ`}
                                    />

                                    {selectedInvoice.customerName && (
                                        <>
                                            <Row
                                                label="Khách hàng:"
                                                value={selectedInvoice.customerName}
                                            />

                                            {!!selectedInvoice.pointsUsed &&
                                                selectedInvoice.pointsUsed > 0 && (
                                                    <Row
                                                        label="Điểm đã dùng:"
                                                        value={`-${(
                                                            selectedInvoice.pointsUsed *
                                                            1000
                                                        ).toLocaleString()} đ`}
                                                        color="#059669"
                                                    />
                                                )}

                                            <Row
                                                label="Điểm tích thêm:"
                                                value={`+${
                                                    selectedInvoice.pointsEarned ?? 0
                                                } điểm`}
                                                color="#059669"
                                            />
                                        </>
                                    )}

                                    <Row
                                        bold
                                        label="THÀNH TIỀN:"
                                        value={`${selectedInvoice.finalAmount.toLocaleString()} đ`}
                                        color="#b91c1c"
                                    />

                                    <Row
                                        label="Phương thức:"
                                        value={methodLabel(selectedInvoice.paymentMethod)}
                                    />

                                    {selectedInvoice.paymentMethod === 'CASH' && (
                                        <>
                                            <Row
                                                label="Khách trả:"
                                                value={`${selectedInvoice.amountPaid.toLocaleString()} đ`}
                                            />
                                            <Row
                                                label="Tiền thừa:"
                                                value={`${selectedInvoice.excessAmount.toLocaleString()} đ`}
                                            />
                                        </>
                                    )}
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 8,
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="primary-button"
                                        style={{
                                            flex: 1,
                                        }}
                                        onClick={() =>
                                            void handleDownloadPdf(
                                                selectedInvoice.invoiceId,
                                            )
                                        }
                                    >
                                        📥 Tải PDF
                                    </button>

                                    <button
                                        type="button"
                                        className="secondary-button"
                                        style={{
                                            flex: 1,
                                        }}
                                        onClick={() => setSelectedInvoice(null)}
                                    >
                                        Đóng
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </PageCard>
    )
}

const gridCols: CSSProperties = {
    gridTemplateColumns: '1fr 0.7fr 0.7fr 1.3fr 1fr 1fr 1fr',
}

const filterInputStyle: CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 13,
}

function btn(background: string, color: string): CSSProperties {
    return {
        background,
        color,
        border: 'none',
        padding: '6px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
    }
}

function Row({
    label,
    value,
    bold,
    color,
}: {
    label: string
    value: string
    bold?: boolean
    color?: string
}) {
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: bold ? 700 : 400,
                color: color ?? '#334155',
                fontSize: bold ? 15 : 13,
                marginBottom: 4,
            }}
        >
            <span>{label}</span>
            <span>{value}</span>
        </div>
    )
}
