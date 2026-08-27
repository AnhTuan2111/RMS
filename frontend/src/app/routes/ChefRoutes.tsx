import {Route} from 'react-router-dom'

import ChefDashboardPage from '../../features/chef/ChefDashboardPage'
import KitchenQueuePage from '../../features/chef/KitchenQueuePage'
import DishListPage from '../../features/chef/DishListPage'
import CompletedOrdersPage from '../../features/chef/CompletedOrdersPage'
import GroupedKitchenPage from '../../features/chef/GroupedKitchenPage'
import CancelledOrdersPage from '../../features/chef/CancelledOrdersPage'

export function renderChefRoutes() {
    return (
        <>
            <Route path="/chef/dashboard" element={<ChefDashboardPage />} />
            <Route path="/chef/orders" element={<KitchenQueuePage />} />
            <Route path="/chef/dishes" element={<DishListPage />} />
            <Route path="/chef/grouped-orders" element={<GroupedKitchenPage />} />
            <Route path="/chef/cancelled-orders" element={<CancelledOrdersPage />} />
            <Route path="/chef/completed-orders" element={<CompletedOrdersPage />} />
        </>
    )
}
