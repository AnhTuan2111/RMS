import {Route} from 'react-router-dom'

import CashierPaymentsPage from '../../features/cashier/CashierPaymentsPage'
import CashierInvoicesPage from '../../features/cashier/CashierInvoicesPage'
import PaymentSuccess from '../../features/cashier/PaymentSuccess'
import PaymentFailed from '../../features/cashier/PaymentFailed'

export function renderCashierRoutes() {
    return (
        <>
            <Route path="/cashier/payments" element={<CashierPaymentsPage />} />
            <Route path="/cashier/invoices" element={<CashierInvoicesPage />} />
        </>
    )
}

export function renderPaymentResultRoutes() {
    return (
        <>
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-failed" element={<PaymentFailed />} />
        </>
    )
}
