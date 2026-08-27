/**
 * shared/api/admin/menu.ts
 * Category, dish, and menu dashboard endpoints.
 * Split from the original 637-line admin/index.ts god file.
 */

import {apiClient} from '../client'
import type {
    CategoryFormData,
    CategoryResponse,
    DishFormData,
    DishResponse,
    MenuDashboardData,
} from '@/shared/types/admin'

// Re-export types so callers can import from this file alone
export type {
    CategoryFormData,
    CategoryResponse,
    DishFormData,
    DishResponse,
    MenuDashboardData,
}

/** Returns all categories */
export const getAllCategories = (signal?: AbortSignal) =>
    apiClient.get<CategoryResponse[]>('/admin/category/all', {signal})

/** Creates a new category */

export const createCategory = (data: Pick<CategoryFormData, 'name' | 'description'>) =>
    apiClient.post<CategoryResponse>('/admin/category/new', data)

/** Updates an existing category */

export const updateCategory = (id: number, data: CategoryFormData) =>
    apiClient.put<CategoryResponse>(`/admin/category/${id}`, data)

/** Soft-deletes a category */

export const deleteCategory = (id: number) => apiClient.delete(`/admin/category/${id}`)

/** Returns all dishes */
export const getAllDishes = (signal?: AbortSignal) =>
    apiClient.get<DishResponse[]>('/admin/dish/all', {signal})

/** Creates a new dish. isAvailable is omitted — backend defaults it to true;
 *  chỉ Chef mới đổi field này qua trang riêng của Chef. */

export const createDish = (data: {
    name: string
    description: string
    price: number
    imageUrl: string
    categoryId: number
    isHidden: boolean
}) => apiClient.post<DishResponse>('/admin/dish/new', data)

/** Updates an existing dish. isAvailable phải gửi kèm (backend @NotNull)
 *  nhưng luôn là giá trị hiện tại, không cho Admin sửa — field này do Chef sở hữu. */

export const updateDish = (
    id: number,
    data: {
        name: string
        description: string
        price: number
        imageUrl: string
        categoryId: number
        isAvailable: boolean
        isHidden: boolean
    },
) => apiClient.put<DishResponse>(`/admin/dish/update/${id}`, data)

/** Deletes a dish */

export const deleteDish = (id: number) => apiClient.delete(`/admin/dish/delete/${id}`)

/** Returns the menu dashboard overview */
export const getMenuDashboard = (signal?: AbortSignal) =>
    apiClient.get<MenuDashboardData>('/admin/menu', {signal})
