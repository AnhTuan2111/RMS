import {useCallback, useRef, useState} from 'react'
import {Link} from 'react-router-dom'

import {getChefDashboard, type ChefDashboardResponse} from '@/shared/api/chef'
import {REALTIME_CONFIG} from '@/app/config/realtime'
import {ErrorState, LoadingState} from '@/shared/components/feedback'
import {PageCard, PageHeader} from '@/shared/components/ui'
import {usePolling} from '@/shared/hooks/usePolling'

export default function ChefDashboardPage() {
    const [dashboard, setDashboard] = useState<ChefDashboardResponse | null>(null)

    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const hasLoadedInitialDashboardRef = useRef(false)

    const fetchDashboard = useCallback(
        async (showFullLoading: boolean, signal?: AbortSignal) => {
            try {
                if (showFullLoading) {
                    setIsLoading(true)
                }

                const data = await getChefDashboard(signal)

                setDashboard(data)
                setError(null)
            } catch (requestError) {
                if (signal?.aborted) {
                    return
                }

                console.error('[CHEF_DASHBOARD_FETCH_ERROR]', requestError)

                setError('Không thể tải số liệu tổng quan bếp.')
            } finally {
                if (showFullLoading) {
                    setIsLoading(false)
                }
            }
        },
        [],
    )

    usePolling(
        async (signal) => {
            const isInitialLoad = !hasLoadedInitialDashboardRef.current

            await fetchDashboard(isInitialLoad, signal)

            hasLoadedInitialDashboardRef.current = true
        },
        {
            intervalMs: REALTIME_CONFIG.chef.dashboardIntervalMs,

            runImmediately: true,
            pauseWhenHidden: true,

            onError: (requestError) => {
                console.error('[CHEF_DASHBOARD_POLL_ERROR]', requestError)
            },
        },
    )

    if (isLoading) {
        return (
            <LoadingState
                title="Đang tải tổng quan bếp..."
                description="Hệ thống đang cập nhật số liệu bếp."
            />
        )
    }

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    fetchDashboard(true).catch((requestError) => {
                        console.error(requestError)
                    })
                }}
            />
        )
    }

    if (!dashboard) {
        return (
            <ErrorState
                title="Không có dữ liệu"
                message="Tổng quan bếp chưa có dữ liệu để hiển thị."
                onRetry={() => {
                    fetchDashboard(true).catch((requestError) => {
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
                    title="Tổng quan bếp"
                    description="Theo dõi nhanh trạng thái món ăn, hàng đợi bếp và tình trạng thực đơn."
                />
            </PageCard>

            <div className="chef-dashboard-grid">
                <Link to="/chef/orders" className="chef-dashboard-card">
                    <span className="chef-dashboard-card-label">Đang chế biến</span>

                    <strong>{dashboard.preparingCount}</strong>

                    <p>Món đang nằm trong hàng đợi bếp.</p>
                </Link>

                <Link to="/chef/completed-orders" className="chef-dashboard-card success">
                    <span className="chef-dashboard-card-label">
                        Đã hoàn thành hôm nay
                    </span>

                    <strong>{dashboard.completedCount}</strong>

                    <p>Món đã được bếp xác nhận hoàn thành trong ngày hôm nay.</p>
                </Link>

                <Link to="/chef/cancelled-orders" className="chef-dashboard-card danger">
                    <span className="chef-dashboard-card-label">Đã hủy hôm nay</span>

                    <strong>{dashboard.cancelledCount}</strong>

                    <p>Món đã bị hủy trong ngày hôm nay và cần Waiter xử lý với khách.</p>
                </Link>
                <Link to="/chef/dishes" className="chef-dashboard-card warning">
                    <span className="chef-dashboard-card-label">Món đang tắt bán</span>

                    <strong>{dashboard.unavailableDishCount}</strong>

                    <p>Món hiện không khả dụng trên thực đơn.</p>
                </Link>
            </div>

            <PageCard>
                <div className="chef-dashboard-actions">
                    <Link to="/chef/orders" className="primary-button">
                        Xem hàng đợi bếp
                    </Link>

                    <Link to="/chef/grouped-orders" className="secondary-button">
                        Xem món đã gom
                    </Link>

                    <Link to="/chef/dishes" className="secondary-button">
                        Quản lý món ăn
                    </Link>
                </div>
            </PageCard>
        </div>
    )
}
