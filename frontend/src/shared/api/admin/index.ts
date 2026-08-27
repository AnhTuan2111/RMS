/**
 * Điểm gom của toàn bộ API dành cho Admin.
 *
 * Mọi module ở đây chỉ export hàm rời, không export object gộp. Nơi gọi dùng
 * `import * as adminApi from '@/shared/api/admin'` để vẫn viết được
 * `adminApi.getAllDishes()` mà bundler vẫn loại bỏ được hàm không dùng tới.
 */

export * from './accounts'
export * from './invoices'
export * from './revenue'
export * from './menu'
