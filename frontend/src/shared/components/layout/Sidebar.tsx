import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import { ROLE_LABELS, roleMenus } from '@/app/config/roleMenus'
import { useActor } from '@/app/providers/ActorContext'
import { RoleType } from '@/shared/types/auth'

function getMenuIcon(path: string) {
    if (path.includes('dashboard')) return '▦'
    if (path.includes('completed')) return '✓'
    if (path.includes('orders')) return '⌁'
    if (path.includes('dishes')) return '◉'
    if (path.includes('tables')) return '▤'
    if (path.includes('reservations')) return '◷'
    if (path.includes('payments')) return '₫'
    if (path.includes('invoices')) return '▧'
    if (path.includes('menu')) return '❏'
    if (path.includes('categories')) return '🞖'
    if (path.includes('statistics')) return '🛈'
    if (path.includes('users')) return '♙'
    if (path.includes('profile'))
        return (
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2"
                />
                <circle
                    cx="12"
                    cy="9"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                />
                <path
                    d="M7.5 17C8.8 14.8 15.2 14.8 16.5 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>
        )
    return '•'
}

export function Sidebar() {
    const { actor } = useActor()
    const menus = roleMenus[actor] ?? []

    const stored = localStorage.getItem('currentUser')
    const currentUser = stored ? JSON.parse(stored) as { fullName: string; username: string } : null

    return (
        <aside className="app-sidebar rims-sidebar">
            <div className="rims-sidebar-brand">
                <div className="rims-sidebar-logo">
                    {actor === RoleType.CUSTOMER ? '满' : 'R'}
                </div>
                <div>
                    <h2>{actor === RoleType.CUSTOMER ? 'MÃN VỊ LÂU' : 'RIMS'}</h2>
                    <p>
                        {actor === RoleType.CUSTOMER
                            ? 'Ẩm thực Trung Hoa cao cấp'
                            : 'Vận hành nhà hàng'}
                    </p>
                </div>
            </div>

            <div className="rims-sidebar-role">
                <div className="rims-role-icon">✦</div>
                <div>
                    <small>Không gian làm việc</small>
                    <strong>{ROLE_LABELS[actor]}</strong>
                </div>
            </div>

            <nav className="rims-sidebar-nav">

                {menus.map((item) => (
                    <Fragment key={item.path}>
                        <NavLink
                            to={item.path}
                            className={({ isActive }) =>
                                isActive
                                    ? 'rims-sidebar-link active'
                                    : 'rims-sidebar-link'
                            }
                        >
                            <span className="rims-menu-icon">
                                {getMenuIcon(item.path)}
                            </span>

                            <span className="rims-menu-label">
                                {item.label}
                            </span>

                            <span className="rims-menu-arrow">
                                ›
                            </span>
                        </NavLink>

                        {item.quickLinks && item.quickLinks.length > 0 && (
                            <div className="rims-sidebar-quick-links">
                                {item.quickLinks.map((quickLink) => (
                                    <NavLink
                                        key={quickLink.path}
                                        to={quickLink.path}
                                        className={({ isActive }) =>
                                            [
                                                'rims-sidebar-quick-link',
                                                `quick-${quickLink.variant}`,
                                                isActive ? 'active' : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')
                                        }
                                    >
                                        <span className="rims-sidebar-quick-icon">
                                            {quickLink.icon}
                                        </span>

                                        <span className="rims-sidebar-quick-label">
                                            {quickLink.label}
                                        </span>

                                        <span className="rims-sidebar-quick-arrow">
                                            ›
                                        </span>
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </Fragment>
                ))}
            </nav>

            <div className="rims-sidebar-status">
                <span className="rims-online-dot" />
                <div>
                    <strong>{currentUser?.fullName ?? currentUser?.username ?? 'Người dùng'}</strong>
                    <small>Hệ thống hoạt động</small>
                </div>
            </div>
        </aside>
    )
}
