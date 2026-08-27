import {type CSSProperties, useCallback, useEffect, useState} from 'react'

import {cashierApi} from '@/shared/api/cashier'
import {REALTIME_CONFIG} from '@/app/config/realtime'
import {ErrorState, LoadingState} from '@/shared/components/feedback'
import {PageCard, PageHeader} from '@/shared/components/ui'
import {usePolling} from '@/shared/hooks/usePolling'
import {useCashierSocket} from '@/realtime'
import type {
    OrderDetailResponse,
    PaymentResponse,
    TableDashboardResponse,
} from '@/shared/types/cashier'
import OrderPanel, {type CustomerInfo} from './components/OrderPanel'
import PaymentModal from './components/PaymentModal'
import PaymentResultManager from './components/PaymentResultManager'

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

function getTableStatusLabel(status: TableDashboardResponse['status']) {
    switch (status) {
        case 'SERVING':
            return '● Đang Phục Vụ'

        default:
            return '○ Bàn Trống'
    }
}

export default function CashierPaymentsPage() {
    const [tables, setTables] = useState<TableDashboardResponse[]>([])

    const [selectedTable, setSelectedTable] = useState<TableDashboardResponse | null>(
        null,
    )

    const [orderDetail, setOrderDetail] = useState<OrderDetailResponse | null>(null)

    const [isLoading, setIsLoading] = useState<boolean>(true)

    const [loadingDetails, setLoadingDetails] = useState<boolean>(false)

    const [error, setError] = useState<string | null>(null)

    const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false)

    const [paymentResult, setPaymentResult] = useState<PaymentResponse | null>(null)

    const [customer, setCustomer] = useState<CustomerInfo | null>(null)

    const [pointsUsed, setPointsUsed] = useState<number>(0)

    const [invoiceSnapshot, setInvoiceSnapshot] = useState<OrderDetailResponse | null>(
        null,
    )

    const loadTables = useCallback(
        async (signal?: AbortSignal, showFullLoading = true, resetError = true) => {
            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                if (resetError) {
                    setError(null)
                }

                const response = await cashierApi.getTables(signal)

                if (signal?.aborted) {
                    return
                }

                setTables(response.data)

                setSelectedTable((currentTable) => {
                    if (!currentTable) {
                        return currentTable
                    }

                    const updatedTable = response.data.find(
                        (table) => table.tableId === currentTable.tableId,
                    )

                    if (!updatedTable) {
                        return currentTable
                    }

                    if (updatedTable.status !== 'SERVING') {
                        setOrderDetail(null)
                        setCustomer(null)
                        setPointsUsed(0)
                        return updatedTable
                    }

                    return updatedTable
                })

                setError(null)
            } catch (requestError: unknown) {
                if (signal?.aborted || isRequestCanceled(requestError)) {
                    return
                }

                console.error('[CASHIER_TABLES_FETCH_ERROR]', requestError)

                setError('Không thể tải danh mục bàn ăn.')
            } finally {
                if (showFullLoading && !signal?.aborted) {
                    setIsLoading(false)
                }
            }
        },
        [],
    )

    const loadOrderDetail = useCallback(
        async (
            orderId: number,
            signal?: AbortSignal,
            showLoading = true,
            showErrorAlert = true,
        ) => {
            try {
                if (showLoading) {
                    setLoadingDetails(true)
                }

                const response = await cashierApi.getOrderDetail(orderId, signal)

                if (signal?.aborted) {
                    return
                }

                setOrderDetail(response.data)
            } catch (requestError: unknown) {
                if (signal?.aborted || isRequestCanceled(requestError)) {
                    return
                }

                console.error('[CASHIER_ORDER_DETAIL_FETCH_ERROR]', requestError)

                if (showErrorAlert) {
                    alert('Không thể lấy chi tiết đơn hàng.')
                }
            } finally {
                if (showLoading && !signal?.aborted) {
                    setLoadingDetails(false)
                }
            }
        },
        [],
    )

    // Initial load on mount
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadTables()
        }, 0)

        return () => window.clearTimeout(timer)
    }, [loadTables])

    // WebSocket: refresh table dashboard when backend broadcasts /topic/tables
    useCashierSocket(() => void loadTables(undefined, false, false))

    usePolling(
        async (signal) => {
            if (
                !selectedTable?.orderId ||
                selectedTable.status !== 'SERVING' ||
                showPaymentModal ||
                Boolean(paymentResult)
            ) {
                return
            }

            await loadOrderDetail(selectedTable.orderId, signal, false, false)
        },
        {
            enabled:
                Boolean(selectedTable?.orderId) &&
                selectedTable?.status === 'SERVING' &&
                !showPaymentModal &&
                !paymentResult,

            intervalMs: REALTIME_CONFIG.cashier.orderDetailIntervalMs,
            runImmediately: false,
            pauseWhenHidden: true,

            onError: (requestError) => {
                if (isRequestCanceled(requestError)) {
                    return
                }

                console.error('[CASHIER_ORDER_DETAIL_POLL_ERROR]', requestError)
            },
        },
    )

    async function handleSelectTable(table: TableDashboardResponse) {
        if (table.status !== 'SERVING') {
            setSelectedTable(null)
            setOrderDetail(null)
            setCustomer(null)
            setPointsUsed(0)
            return
        }

        setSelectedTable(table)
        setOrderDetail(null)
        setCustomer(null)
        setPointsUsed(0)

        if (table.orderId) {
            await loadOrderDetail(table.orderId, undefined, true, true)
        }
    }

    async function handleDownloadPdf(invoiceId: number) {
        try {
            const response = await cashierApi.downloadInvoicePdf(invoiceId)
            const blob = new Blob([response.data], {
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
            console.error(requestError)
            alert('Không thể tải PDF!')
        }
    }

    const gridLayoutLayout: CSSProperties = selectedTable
        ? {
              display: 'grid',
              gridTemplateColumns: '1.4fr 0.6fr',
              gap: '1.5rem',
          }
        : {
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '1.5rem',
          }

    if (isLoading) {
        return (
            <LoadingState
                title="Đang tải sơ đồ quầy thu ngân..."
                description="Hệ thống đang lấy trạng thái bàn và đơn hàng mới nhất."
            />
        )
    }

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    loadTables(undefined, true, true).catch((requestError) => {
                        console.error(requestError)
                    })
                }}
            />
        )
    }

    return (
        <div className="dashboard-page" style={gridLayoutLayout}>
            <PageCard>
                <PageHeader
                    title="Sơ Đồ Quầy Thu Ngân"
                    description="Danh sách bàn ăn tại nhà hàng. Dữ liệu được tự cập nhật theo thời gian thực."
                />

                <div
                    className="table-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gap: '1rem',
                    }}
                >
                    {tables.map((table) => {
                        const isSelected = selectedTable?.tableId === table.tableId

                        const isServing = table.status === 'SERVING'

                        return (
                            <button
                                key={table.tableId}
                                type="button"
                                onClick={() => {
                                    void handleSelectTable(table)
                                }}
                                style={{
                                    border: isSelected
                                        ? '2px solid #2563eb'
                                        : '1px solid #e2e8f0',
                                    background: isServing ? '#fff7ed' : '#ffffff',
                                    padding: '1.5rem',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    cursor: 'pointer',
                                    width: '100%',
                                    textAlign: 'left',
                                }}
                            >
                                <strong
                                    style={{
                                        fontSize: '1.2rem',
                                    }}
                                >
                                    {table.tableNumber}
                                </strong>

                                <span
                                    style={{
                                        fontSize: '0.85rem',
                                        color: '#64748b',
                                        marginBottom: '8px',
                                    }}
                                >
                                    ID Đơn:{' '}
                                    {isServing ? table.orderId || 'Đang quét...' : 'null'}
                                </span>

                                <small
                                    style={{
                                        color: isServing ? '#ea580c' : '#16a34a',
                                        marginTop: 'auto',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    {getTableStatusLabel(table.status)}
                                </small>
                            </button>
                        )
                    })}
                </div>
            </PageCard>

            {selectedTable && (
                <OrderPanel
                    selectedTable={selectedTable}
                    orderDetail={orderDetail}
                    loading={loadingDetails}
                    onClose={() => {
                        setSelectedTable(null)
                        setOrderDetail(null)
                        setCustomer(null)
                        setPointsUsed(0)
                    }}
                    onCheckout={() => setShowPaymentModal(true)}
                    customer={customer}
                    pointsUsed={pointsUsed}
                    onCustomerChange={setCustomer}
                    onPointsUsedChange={setPointsUsed}
                />
            )}

            {showPaymentModal && selectedTable && orderDetail && (
                <PaymentModal
                    orderId={orderDetail.orderId}
                    orderDetail={orderDetail}
                    customer={customer}
                    pointsUsed={pointsUsed}
                    onClose={() => setShowPaymentModal(false)}
                    onSuccess={(result: PaymentResponse) => {
                        setShowPaymentModal(false)
                        setInvoiceSnapshot(orderDetail)
                        setPaymentResult(result)
                    }}
                />
            )}

            {paymentResult && invoiceSnapshot && (
                <PaymentResultManager
                    paymentResult={paymentResult}
                    orderDetail={invoiceSnapshot}
                    onDownload={(invoiceId) => {
                        void handleDownloadPdf(invoiceId)
                    }}
                    onClose={() => {
                        setPaymentResult(null)
                        setInvoiceSnapshot(null)
                        setSelectedTable(null)
                        setOrderDetail(null)
                        setCustomer(null)
                        setPointsUsed(0)
                        void loadTables(undefined, true, true)
                    }}
                />
            )}
        </div>
    )
}
