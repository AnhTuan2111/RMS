import {RoleType} from '@/shared/types/auth'
export const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    CHEF: 'Đầu bếp',
    WAITER: 'Phục vụ',
    CASHIER: 'Thu ngân',
    CUSTOMER: 'Khách hàng',
}

export const ROLE_COLORS: Record<string, {bg: string; text: string}> = {
    ADMIN: {bg: '#fef3c7', text: '#92400e'},
    CHEF: {bg: '#fee2e2', text: '#991b1b'},
    WAITER: {bg: '#dbeafe', text: '#1e40af'},
    CASHIER: {bg: '#d1fae5', text: '#065f46'},
    CUSTOMER: {bg: '#ede9fe', text: '#5b21b6'},
}

export const STAFF_ROLES = [RoleType.CHEF, RoleType.WAITER, RoleType.CASHIER]

export type Tab = 'staff' | 'customer'

export type ModalType = 'create-staff' | 'create-customer' | 'edit' | 'detail' | null
