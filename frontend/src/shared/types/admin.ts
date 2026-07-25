/**
 * shared/types/admin.ts
 * Admin-only DTOs extracted from shared/api/admin/index.ts.
 * API files should import HTTP; types should live here.
 */

// ── Payment / Invoice ────────────────────────────────────────────────────────

export type AdminPaymentMethod = 'CASH' | 'QRCODE'

export interface AdminPaymentHistoryItem {
    invoiceId: number
    orderId: number
    tableNumber: string
    paymentMethod: AdminPaymentMethod
    amount: number
    paymentDate: string
}

export interface AdminPaymentHistoryPage {
    items: AdminPaymentHistoryItem[]
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
}

export interface AdminPaymentDetailItem {
    dishName: string
    quantity: number
    unitPrice: number
    amount: number
}

export interface AdminPaymentDetail {
    invoiceId: number
    orderId: number
    tableNumber: string
    paymentMethod: string
    totalBeforeVat: number
    vatAmount: number
    finalAmount: number
    amountPaid: number
    excessAmount: number
    invoiceDate: string
    items: AdminPaymentDetailItem[]
}

// ── Revenue ───────────────────────────────────────────────────────────────────

export interface RevenueReportResponse {
    revenue: number
    period: string
}

export interface DailyRevenueItem {
    dayLabel: string
    date: string
    revenue: number
}

export interface WeeklyRevenueChartResponse {
    fromDate: string
    toDate: string
    items: DailyRevenueItem[]
}

export interface BestSellingDishItem {
    rank: number
    dishName: string
    imageUrl?: string | null
    totalQuantity: number
    totalRevenue: number
}

export interface BestSellingReportResponse {
    fromDate: string
    toDate: string
    dataRangeNote: string
    items: BestSellingDishItem[]
}

export interface HighestOrderShift {
    shiftName: string
    displayName: string
    startTime: string
    endTime: string
    orderCount: number
    percentage: number
}

export type OrderShiftItem = HighestOrderShift

export interface OrderShiftReportResponse {
    startDate: string
    endDate: string
    totalPaidOrders: number
    averageOrdersPerDay: number
    highestOrderShift: HighestOrderShift
    shifts: OrderShiftItem[]
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export interface CreateCustomerRequest {
    username: string
    fullName: string
    email: string
    phone: string
    password: string
}

export interface CreateStaffRequest {
    username: string
    fullName: string
    email: string
    phone: string
    role: string
    password: string
}

export interface UpdateAccountRequest {
    username: string
    fullName: string
    email: string
    phone: string
    role?: string
}

export interface UpdateOwnProfileRequest {
    fullName: string
    username: string
    email: string
    phone: string
}

export interface UserProfileResponse {
    userId: number
    username: string
    fullName: string
    phone: string
    email: string
    role: string
    rewardPoints?: number
}

export interface SetAccountStatusRequest {
    active: boolean
}

export interface PageResponse<T> {
    content: T[]
    page: number
    size: number
    totalElements: number
    totalPages: number
    first: boolean
    last: boolean
}

export interface GetAccountsParams {
    keyword?: string
    active?: boolean
    page?: number
    size?: number
}

// ── Menu ──────────────────────────────────────────────────────────────────────

export interface CategoryResponse {
    id: number
    name: string
    description: string
    isAvailable: boolean
    createdAt: string
    updatedAt: string
    dishCount?: number
}

export interface DishResponse {
    id: number
    name: string
    description: string
    price: number
    imageUrl: string
    isAvailable: boolean
    isHidden: boolean
    categoryName: string
    createdAt: string
    updatedAt: string
}

export interface CategoryFormData {
    name: string
    description: string
    isAvailable: boolean
}

export interface DishFormData {
    name: string
    categoryId: string
    price: number
    description: string
    imageUrl: string
    isHidden: boolean
}

export interface DishSummary {
    id: number
    name: string
    categoryName: string
    price: number
    imageUrl: string
    status: 'AVAILABLE' | 'PAUSED' | 'HIDDEN'
}

export interface CategoryStat {
    categoryName: string
    status: 'ACTIVE' | 'HIDDEN'
    dishCount: number
}

export interface MenuDashboardData {
    totalDishes: number
    totalCategories: number
    totalPausedDishes: number
    totalHiddenDishes: number
    latestDishes: DishSummary[]
    categoryStats: CategoryStat[]
    allPausedDishesList?: DishSummary[]
}
