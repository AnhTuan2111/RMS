export const DEFAULT_POLL_INTERVAL_MS = 5_000

export const REALTIME_CONFIG = {
    defaultIntervalMs: DEFAULT_POLL_INTERVAL_MS,

    chef: {
        kitchenQueueIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        dashboardIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        groupedOrdersIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        dishListIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        completedOrdersIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        cancelledOrdersIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    },

    waiter: {
        tablesIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        orderDetailIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    },

    cashier: {
        orderDetailIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        tablesIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        invoicesIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    },

    admin: {
        dashboardIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    },

    customer: {
        reservationIntervalMs: 30_000,
    },
} as const
