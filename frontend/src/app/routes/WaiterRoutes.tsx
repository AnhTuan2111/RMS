import {Route} from 'react-router-dom'

import WaiterTableListPage from '../../features/waiter/WaiterTableListPage'
import WaiterCreateOrderPage from '../../features/waiter/WaiterCreateOrderPage'
import WaiterOrderDetailPage from '../../features/waiter/WaiterOrderDetailPage'
import WaiterUpdateOrderPage from '../../features/waiter/WaiterUpdateOrderPage'
import WaiterReservationDetailPage from '../../features/waiter/WaiterReservationDetailPage'
import WaiterCreateReservationPage from '../../features/waiter/WaiterCreateReservationPage'
import WaiterEditReservationPage from '../../features/waiter/WaiterEditReservationPage'

export function renderWaiterRoutes() {
    return (
        <>
            <Route path="/waiter/tables" element={<WaiterTableListPage />} />
            <Route
                path="/waiter/tables/:tableId/order/new"
                element={<WaiterCreateOrderPage />}
            />
            <Route
                path="/waiter/tables/:tableId/order/detail"
                element={<WaiterOrderDetailPage />}
            />
            <Route
                path="/waiter/tables/:tableId/order/edit"
                element={<WaiterUpdateOrderPage />}
            />
            <Route
                path="/waiter/tables/:tableId/reservation"
                element={<WaiterReservationDetailPage />}
            />
            <Route
                path="/waiter/reservations"
                element={<WaiterCreateReservationPage />}
            />
            <Route
                path="/waiter/reservations/:resId/edit"
                element={<WaiterEditReservationPage />}
            />
        </>
    )
}
