import {useActor} from '@/app/providers/ActorContext'
import {RoleType} from '@/shared/types/auth'

type DashboardTopbarProps = {
    onLogout: () => void
}

export function DashboardTopbar({
                                    onLogout,
                                }: DashboardTopbarProps) {
    const {actor} = useActor()
    const isCustomer = actor === RoleType.CUSTOMER

    const stored = localStorage.getItem('currentUser')
    const currentUser = stored
        ? JSON.parse(stored) as {fullName: string; username: string}
        : null

    return (
        <header className="rims-topbar">
            <div className="rims-topbar-heading">
                {isCustomer ? (
                    <>
                        <span className="rims-topbar-eyebrow">
                            <span className="rims-topbar-live-dot"/>
                            MÃN VỊ LÂU
                        </span>

                        <h1>
                            Chào mừng, {currentUser?.fullName ?? currentUser?.username ?? 'Quý khách'}
                        </h1>

                        <p>
                            Quản lý đặt bàn và hồ sơ cá nhân của bạn.
                        </p>
                    </>
                ) : (
                    <>
                        <span className="rims-topbar-eyebrow">
                            <span className="rims-topbar-live-dot"/>
                            TRUNG TÂM ĐIỀU HÀNH RIMS
                        </span>

                        <h1>Hệ thống quản lý nhà hàng</h1>

                        <p>
                            Theo dõi và điều phối hoạt động nhà hàng theo thời
                            gian thực.
                        </p>
                    </>
                )}
            </div>

            <div className="rims-topbar-actions">
                <button
                    id="btn-logout"
                    type="button"
                    onClick={onLogout}
                    className="rims-logout-btn"
                >
                    <svg
                        className="rims-logout-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>

                    Đăng xuất
                </button>
            </div>
        </header>
    )
}