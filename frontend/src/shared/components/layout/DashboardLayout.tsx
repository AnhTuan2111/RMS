import {Outlet, useNavigate} from 'react-router-dom'
import {useAuth} from '@/app/providers/AuthContext'
import {useActor} from '@/app/providers/ActorContext'
import {RoleType} from '@/shared/types/auth'
import {Sidebar} from '@/shared/components/layout/Sidebar'
import {DashboardTopbar} from './DashboardTopbar'

export default function DashboardLayout() {
    const navigate = useNavigate()
    const {logout} = useAuth()
    const {actor} = useActor()

    async function handleLogout() {
        await logout()
        navigate('/login', {replace: true})
    }

    const layoutClassName =
        actor === RoleType.CUSTOMER
            ? 'app-layout theme-customer'
            : 'app-layout'

    return (
        <div className={layoutClassName}>
            <Sidebar/>
            <div className="app-main">
                <DashboardTopbar onLogout={handleLogout}/>
                <main className="app-content rims-app-content">
                    <Outlet/>
                </main>
            </div>
        </div>
    )
}