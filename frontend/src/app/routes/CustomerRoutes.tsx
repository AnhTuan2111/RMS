import {Route} from 'react-router-dom'

import CustomerReservations from '../../features/customer/CustomerReservations'

export function renderCustomerRoutes() {
    return (
        <>
            <Route path="/customer/reservations" element={<CustomerReservations />} />
        </>
    )
}
