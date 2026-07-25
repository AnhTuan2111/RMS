import {
    useCallback,
    useEffect,
    useState,
    type FormEvent,
} from 'react';
import { categoryApi, dishApi } from '@/shared/api/admin';
import type { DishResponse, CategoryResponse, DishFormData } from '@/shared/api/admin';
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from '@/shared/components/feedback';
import {
    PageCard,
    PageHeader,
} from '@/shared/components/ui';
import {useWaiterSocket} from '@/realtime';

type ModalType = 'NONE' | 'CREATE' | 'VIEW' | 'EDIT' | 'DELETE';

// --- Pagination Config ---
const ITEMS_PER_PAGE = 5;


type ErrorResponseShape = {
    response?: {
        data?: {
            message?: unknown;
            error?: unknown;
        };
    };
};

function getRequestErrorMessage(
    error: unknown,
    fallbackMessage: string,
) {
    const errorResponse = error as ErrorResponseShape;
    const message = errorResponse.response?.data?.message;
    const responseError = errorResponse.response?.data?.error;

    if (
        typeof message === 'string'
        && message.trim().length > 0
    ) {
        return message;
    }

    if (
        typeof responseError === 'string'
        && responseError.trim().length > 0
    ) {
        return responseError;
    }

    return fallbackMessage;
}

export default function AdminDishesPage() {
    // --- States ---
    const [dishes, setDishes] = useState<DishResponse[]>([]);
    const [categories, setCategories] = useState<CategoryResponse[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

    // --- Pagination States ---
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Modal states
    const [activeModal, setActiveModal] = useState<ModalType>('NONE');
    const [selectedDish, setSelectedDish] = useState<DishResponse | null>(null);

    // Form data
    const [formData, setFormData] = useState<DishFormData>({
        name: '',
        categoryId: '',
        price: 0,
        description: '',
        imageUrl: '',
        isHidden: false
    });

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);



    // --- Load Data ---
    const loadAllData = useCallback(
        async (
            signal?: AbortSignal,
            showFullLoading = true,
            resetPage = true,
        ) => {
            try {
                if (showFullLoading) {
                    setLoading(true);
                }

                const [dishRes, catRes] = await Promise.all([
                    dishApi.getAllDishes(signal),
                    categoryApi.getAllCategories(signal),
                ]);

                setDishes(dishRes.data);
                setCategories(catRes.data);
                setError(null);

                if (resetPage) {
                    setCurrentPage(1);
                }
            } catch (requestError: unknown) {
                console.error(
                    '[ADMIN_DISHES_FETCH_ERROR]',
                    requestError,
                );
                setError("Không thể tải danh sách món ăn từ hệ thống.");
            } finally {
                if (showFullLoading) {
                    setLoading(false);
                }
            }
        },
        [],
    );

    useEffect(() => {
        const controller = new AbortController();

        queueMicrotask(() => {
            void loadAllData(controller.signal, true, true);
        });

        return () => controller.abort();
    }, [loadAllData]);

    // WebSocket: silently refresh dish list when any menu-visibility
    // change is broadcast (Admin ẩn/hiện món, hoặc Chef đổi hết hàng).
    // /topic/waiter đã cho phép role ADMIN subscribe từ trước, không cần sửa backend.
    useWaiterSocket(
        () => void loadAllData(undefined, false, false),
        () => {},
    );

    // --- CRUD Handlers ---
    const handleCreateDish = async (e: FormEvent) => {
        e.preventDefault();

        const catIdParsed = parseInt(formData.categoryId);
        if (isNaN(catIdParsed) || catIdParsed <= 0) {
            alert("Lỗi: Vui lòng lựa chọn một Danh mục món ăn hợp lệ!");
            return;
        }

        const targetCategory = categories.find(c => c.id === catIdParsed);
        if (targetCategory && !targetCategory.isAvailable) {
            alert(`Lỗi: Danh mục "${targetCategory.name}" đang bị ẩn, không thể thêm món ăn mới vào đây!`);
            return;
        }

        if (formData.imageUrl && formData.imageUrl.length > 500) {
            alert("Lỗi: Đường dẫn hình ảnh quá dài (tối đa 500 ký tự)!");
            return;
        }


        try {
            setIsSubmitting(true);
            await dishApi.createDish({
                name: formData.name.trim(),
                description: formData.description,
                price: formData.price,
                imageUrl: formData.imageUrl,
                categoryId: catIdParsed,
                isHidden: formData.isHidden
            });
            setActiveModal('NONE');
            await loadAllData(undefined, true, true);
            alert("Thêm món ăn thành công!");
        } catch (err: unknown) {
            const errMsg = getRequestErrorMessage(
                err,
                "Lỗi khi thêm món ăn mới!",
            );
            alert(errMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateDish = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedDish || isSubmitting) return;

        const catIdParsed = parseInt(formData.categoryId);
        if (isNaN(catIdParsed) || catIdParsed <= 0) {
            alert("Lỗi: Vui lòng lựa chọn một Danh mục món ăn hợp lệ!");
            return;
        }

        const targetCategory = categories.find(c => c.id === catIdParsed);
        if (targetCategory && !targetCategory.isAvailable) {
            alert(`Lỗi: Danh mục "${targetCategory.name}" đang bị ẩn, không thể lưu hoặc chuyển món ăn tới danh mục này!`);
            return;
        }

        if (formData.imageUrl && formData.imageUrl.length > 500) {
            alert("Lỗi: Đường dẫn hình ảnh quá dài (tối đa 500 ký tự)!");
            return;
        }
        try {
            setIsSubmitting(true);
            await dishApi.updateDish(selectedDish.id, {
                name: formData.name.trim(),
                description: formData.description,
                price: formData.price,
                imageUrl: formData.imageUrl,
                categoryId: catIdParsed,
                isAvailable: selectedDish.isAvailable, // giữ nguyên — Chef sở hữu field này
                isHidden: formData.isHidden
            });
            setActiveModal('NONE');
            await loadAllData(undefined, true, true);
            alert("Cập nhật món ăn thành công! ✅");
        } catch (err: unknown) {
            const errMsg = getRequestErrorMessage(
                err,
                "Lỗi khi cập nhật món ăn!",
            );
            alert(errMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteDish = async () => {
        if (!selectedDish) return;
        try {
            await dishApi.deleteDish(selectedDish.id);
            setActiveModal('NONE');
            await loadAllData(undefined, true, true);
            alert("Xóa món ăn thành công! 🗑️");
        } catch (err: unknown) {
            const errMsg = getRequestErrorMessage(
                err,
                "Lỗi khi xóa món ăn!",
            );
            alert(errMsg);
        }
    };

    const openFormWithDish = (dish: DishResponse, modalType: 'VIEW' | 'EDIT') => {
        setSelectedDish(dish);
        const foundCategory = categories.find(c => c.name === dish.categoryName);

        setFormData({
            name: dish.name,
            categoryId: foundCategory ? foundCategory.id.toString() : '',
            price: dish.price,
            description: dish.description || '',
            imageUrl: dish.imageUrl || '',
            isHidden: dish.isHidden
        });
        setActiveModal(modalType);
    };

    // --- Filter Logic ---
    const filteredDishes = dishes.filter(dish => {
        const matchesKeyword = dish.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            `#ID-${String(dish.id).padStart(2, '0')}`.includes(searchKeyword.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || dish.categoryName === selectedCategory;
        const matchesStatus = selectedStatus === 'ALL' ||
            (selectedStatus === 'VISIBLE' && !dish.isHidden) ||
            (selectedStatus === 'HIDDEN' && dish.isHidden);

        return matchesKeyword && matchesCategory && matchesStatus;
    });

    // --- Pagination Logic ---
    const totalItems = filteredDishes.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentItems = filteredDishes.slice(startIndex, endIndex);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const goToPreviousPage = () => goToPage(currentPage - 1);
    const goToNextPage = () => goToPage(currentPage + 1);

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            pages.push(totalPages);
        }

        return pages;
    };

    const activeCategories = categories.filter(c => c.isAvailable);

    if (loading) {
        return (
            <LoadingState
                title="Đang tải danh sách món ăn hệ thống..."
                description="Hệ thống đang lấy dữ liệu món ăn và danh mục mới nhất."
            />
        );
    }

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    loadAllData(undefined, true, true).catch((requestError) => {
                        console.error(requestError);
                    });
                }}
            />
        );
    }

    return (
        <div className="admin-dish-page">
            {/* Header */}
            <PageCard className="admin-dish-header-card">
                <PageHeader
                    title="🍳 Quản lý món ăn"
                    description="Tìm kiếm, thêm, chỉnh sửa và quản lý trạng thái món ăn trong thực đơn."
                    actions={
                        <button
                            type="button"
                            onClick={() => {
                                setFormData({
                                    name: '',
                                    categoryId: activeCategories[0]?.id.toString() || '',
                                    price: 0,
                                    description: '',
                                    imageUrl: '',
                                    isHidden: false
                                });
                                setActiveModal('CREATE');
                            }}
                            className="admin-dish-btn-primary"
                        >
                            <span>+</span> Thêm Món Ăn
                        </button>
                    }
                />
            </PageCard>

            {/* Filters */}
            <div className="admin-dish-filter-grid">
                <div className="admin-dish-card">
                    <div className="admin-dish-filter-container">
                        <input
                            type="text"
                            placeholder="Tìm theo tên món ăn hoặc mã ID..."
                            value={searchKeyword}
                            onChange={(e) => {
                                setSearchKeyword(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="admin-dish-search-input"
                        />
                        <select
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="admin-dish-select"
                        >
                            <option value="ALL">Tất cả danh mục</option>
                            {categories.map(cat => {
                                const displayName = cat.name.length > 25
                                    ? cat.name.slice(0, 25) + '...'
                                    : cat.name;
                                return (
                                    <option key={cat.id} value={cat.name}>
                                        {displayName} {!cat.isAvailable ? '(Đang ẩn)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <select
                            value={selectedStatus}
                            onChange={(e) => {
                                setSelectedStatus(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="admin-dish-select"
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            <option value="VISIBLE">Đang hiển thị</option>
                            <option value="HIDDEN">Đã ẩn</option>
                        </select>
                    </div>
                </div>
                <div className="admin-dish-card admin-dish-stats-card">
                    <div className="admin-dish-stats-inner">
                        <div>
                            <span className="admin-dish-stats-label">MÓN TÌM THẤY</span>
                            <h2 className="admin-dish-stats-number">{filteredDishes.length}</h2>
                        </div>
                        <span className="admin-dish-stats-icon">🍴</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="admin-dish-card admin-dish-table-card">
                <table className="admin-dish-table">
                    <thead>
                    <tr className="admin-dish-table-header">
                        <th className="admin-dish-col-image">HÌNH ẢNH</th>
                        <th className="admin-dish-col-name">TÊN MÓN ĂN</th>
                        <th className="admin-dish-col-category">DANH MỤC</th>
                        <th className="admin-dish-col-price">GIÁ NIÊM YẾT</th>
                        <th className="admin-dish-col-status">TRẠNG THÁI</th>
                        <th className="admin-dish-col-date">NGÀY TẠO</th>
                        <th className="admin-dish-col-actions">THAO TÁC</th>
                    </tr>
                    </thead>
                    <tbody>
                    {currentItems.map((dish) => {
                        const isParentCategoryHidden = categories.find(c => c.name === dish.categoryName)?.isAvailable === false;

                        return (
                            <tr key={dish.id} className="admin-dish-table-row">
                                <td className="admin-dish-cell-image">
                                    <div className="admin-dish-image-container">
                                        <img
                                            src={dish.imageUrl.startsWith('http') ? dish.imageUrl : `/image/${dish.imageUrl}`}
                                            alt={dish.name}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://placehold.co/48x48?text=🍲'
                                            }}
                                        />
                                    </div>
                                </td>
                                <td className="admin-dish-cell-name">
                                    <div className="admin-dish-name">{dish.name}</div>
                                    <small className="admin-dish-sku">ID-{String(dish.id).padStart(2, '0')}</small>
                                </td>
                                <td className="admin-dish-cell-category">
                                        <span className={`admin-dish-category-badge ${isParentCategoryHidden ? 'hidden' : ''}`}>
                                            {dish.categoryName} {isParentCategoryHidden ? '(Ẩn)' : ''}
                                        </span>
                                </td>
                                <td className="admin-dish-cell-price">
                                    {dish.price.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="admin-dish-cell-status">
                                        <span className={`admin-dish-status-badge ${dish.isHidden ? 'paused' : 'available'}`}>
                                            {dish.isHidden ? '● Đã ẩn khỏi menu' : '● Đang hiển thị'}
                                        </span>
                                </td>
                                <td className="admin-dish-cell-date">
                                    {new Date(dish.createdAt).toLocaleDateString('vi-VN')}
                                </td>
                                <td className="admin-dish-cell-actions">
                                    <button
                                        onClick={() => openFormWithDish(dish, 'VIEW')}
                                        className="admin-dish-action-btn"
                                        title="Xem chi tiết"
                                    >
                                        👁️
                                    </button>
                                    <button
                                        onClick={() => openFormWithDish(dish, 'EDIT')}
                                        className="admin-dish-action-btn admin-dish-edit-btn"
                                        title="Chỉnh sửa"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedDish(dish);
                                            setActiveModal('DELETE');
                                        }}
                                        className="admin-dish-action-btn admin-dish-delete-btn"
                                        title="Xóa món"
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
                {filteredDishes.length === 0 && (
                    <EmptyState
                        title="Không tìm thấy món ăn phù hợp"
                        description="Hãy thay đổi từ khóa, danh mục hoặc trạng thái để tìm món ăn."
                        action={
                            <button
                                type="button"
                                className="admin-dish-btn-secondary"
                                onClick={() => {
                                    setSearchKeyword('');
                                    setSelectedCategory('ALL');
                                    setSelectedStatus('ALL');
                                    setCurrentPage(1);
                                }}
                            >
                                Xóa bộ lọc
                            </button>
                        }
                    />
                )}

                {/* Pagination */}
                {filteredDishes.length > 0 && (
                    <div className="admin-dish-pagination">
                        <div className="admin-dish-pagination-info">
                            <span className="admin-dish-pagination-current-page">
                                Trang {currentPage} / {totalPages}
                            </span>
                        </div>
                        <div className="admin-dish-pagination-controls">
                            <button
                                onClick={goToPreviousPage}
                                disabled={currentPage === 1}
                                className="admin-dish-pagination-btn"
                            >
                                ◀
                            </button>
                            {getPageNumbers().map((page, index) => (
                                <button
                                    key={index}
                                    onClick={() => typeof page === 'number' && goToPage(page)}
                                    className={`admin-dish-pagination-btn ${currentPage === page ? 'active' : ''} ${typeof page === 'string' ? 'dots' : ''}`}
                                    disabled={typeof page === 'string'}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={goToNextPage}
                                disabled={currentPage === totalPages}
                                className="admin-dish-pagination-btn"
                            >
                                ▶
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* CREATE MODAL */}
            {/* ========================================================= */}
            {activeModal === 'CREATE' && (
                <div className="admin-dish-modal-backdrop">
                    <form onSubmit={handleCreateDish} className="admin-dish-modal admin-dish-modal-create">
                        <div className="admin-dish-modal-left">
                            <div className="admin-dish-modal-header">
                                <button type="button" onClick={() => setActiveModal('NONE')} className="admin-dish-back-btn">&larr;</button>
                                <h3 className="admin-dish-modal-title">➕ THÊM MÓN ĂN MỚI</h3>
                            </div>

                            <div className="admin-dish-form-group">
                                <div>
                                    <label className="admin-dish-input-label">TÊN MÓN ĂN *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ví dụ: Phở Bò Tái Lăn"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="admin-dish-input-field"
                                    />
                                </div>

                                <div className="admin-dish-form-row">
                                    <div>
                                        <label className="admin-dish-input-label">DANH MỤC THỰC ĐƠN</label>
                                        <select
                                            value={formData.categoryId}
                                            onChange={e => setFormData({...formData, categoryId: e.target.value})}
                                            className="admin-dish-select-field"
                                        >
                                            {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        {activeCategories.length === 0 &&
                                            <small className="admin-dish-error-text">Không có danh mục khả dụng!</small>}
                                    </div>
                                    <div>
                                        <label className="admin-dish-input-label">GIÁ BÁN (VNĐ) *</label>
                                        <input
                                            type="number"
                                            required
                                            value={formData.price || ''}
                                            placeholder="0"
                                            onChange={e => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                                            className="admin-dish-input-field"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="admin-dish-input-label">MÔ TẢ MÓN ĂN</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Mô tả tóm tắt hương vị, các thành phần nguyên liệu đặc biệt..."
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="admin-dish-textarea-field"
                                    />
                                </div>

                                <div className="admin-dish-toggle-row">
                                    <div>
                                        <strong className="admin-dish-toggle-label">Hiển thị trên menu</strong>
                                        <small className="admin-dish-toggle-description">Cho phép Bếp và Phục vụ nhìn thấy món này</small>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={!formData.isHidden}
                                        onChange={e => setFormData({...formData, isHidden: !e.target.checked})}
                                        className="admin-dish-toggle-checkbox"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="admin-dish-modal-right">
                            <div>
                                <label className="admin-dish-input-label">HÌNH ẢNH MINH HỌA</label>
                                <div className="admin-dish-image-preview">
                                    {formData.imageUrl ?
                                        <img src={formData.imageUrl} alt="Preview"/> :
                                        <div className="admin-dish-image-placeholder">
                                            <span>🖼️    </span>
                                            <small>Chưa có hình ảnh</small>
                                        </div>
                                    }
                                </div>
                                <input
                                    type="text"
                                    placeholder="Dán URL hình ảnh đường dẫn công khai (https://...)"
                                    value={formData.imageUrl}
                                    onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                                    className="admin-dish-input-field"
                                />
                            </div>

                            <div className="admin-dish-modal-actions">
                                <button
                                    type="submit"
                                    disabled={activeCategories.length === 0 || isSubmitting}
                                    className={`admin-dish-btn-primary ${activeCategories.length === 0 || isSubmitting ? 'disabled' : ''}`}
                                >
                                    {isSubmitting ? '⏳ Đang thêm...' : '💾 Thêm món ăn'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModal('NONE')}
                                    className="admin-dish-btn-secondary"
                                >
                                    Hủy bỏ
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* ========================================================= */}
            {/* VIEW MODAL */}
            {/* ========================================================= */}
            {activeModal === 'VIEW' && selectedDish && (
                <div className="admin-dish-modal-backdrop">
                    <div className="admin-dish-modal admin-dish-modal-view">
                        <div className="admin-dish-view-left">
                            <div className="admin-dish-view-header">
                                <button onClick={() => setActiveModal('NONE')} className="admin-dish-back-btn">&larr;</button>
                                <span className={`admin-dish-view-status ${selectedDish.isHidden ? 'paused' : 'available'}`}>
                                    {selectedDish.isHidden ? '● Đã ẩn khỏi menu' : '● Đang hiển thị'}
                                </span>
                            </div>
                            <div className="admin-dish-view-image">
                                <img
                                    src={selectedDish.imageUrl.startsWith('http') ? selectedDish.imageUrl : `/image/${selectedDish.imageUrl}`}
                                    alt={selectedDish.name}
                                />
                            </div>
                            <div className="admin-dish-view-sku">
                                <span className="admin-dish-view-sku-label">MÃ ID:</span>
                                <strong>{String(selectedDish.id).padStart(2, '0')}</strong>
                            </div>
                        </div>

                        <div className="admin-dish-view-right">
                            <div>
                                <span className="admin-dish-view-category">{selectedDish.categoryName.toUpperCase()}</span>
                                <h2 className="admin-dish-view-name">{selectedDish.name}</h2>
                                <h3 className="admin-dish-view-price">{selectedDish.price.toLocaleString('vi-VN')}đ</h3>
                                <hr className="admin-dish-divider"/>
                                <h4 className="admin-dish-view-desc-label">MÔ TẢ CHI TIẾT</h4>
                                <div className="admin-dish-view-description">
                                    {selectedDish.description || "Không có mô tả thông tin cụ thể cho món ăn này."}
                                </div>
                            </div>

                            <div className="admin-dish-view-actions">
                                <button
                                    onClick={() => {
                                        setActiveModal('EDIT');
                                    }}
                                    className="admin-dish-btn-primary"
                                >
                                    Chỉnh sửa
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveModal('DELETE');
                                    }}
                                    className="admin-dish-btn-danger"
                                >
                                    🗑️ Xóa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* EDIT MODAL */}
            {/* ========================================================= */}
            {activeModal === 'EDIT' && selectedDish && (
                <div className="admin-dish-modal-backdrop">
                    <form onSubmit={handleUpdateDish} className="admin-dish-modal admin-dish-modal-edit">
                        <div className="admin-dish-modal-left">
                            <div className="admin-dish-modal-header">
                                <button type="button" onClick={() => setActiveModal('NONE')} className="admin-dish-back-btn">&larr;</button>
                                <h3 className="admin-dish-modal-title">✏️ CHỈNH SỬA MÓN ĂN</h3>
                            </div>

                            <div className="admin-dish-form-group">
                                <div className="admin-dish-form-row">
                                    <div>
                                        <label className="admin-dish-input-label">TÊN MÓN ĂN</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            className="admin-dish-input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="admin-dish-input-label">DANH MỤC</label>
                                        <select
                                            value={formData.categoryId}
                                            onChange={e => setFormData({...formData, categoryId: e.target.value})}
                                            className="admin-dish-select-field"
                                        >
                                            <option value="">-- Chọn danh mục --</option>
                                            {activeCategories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="admin-dish-form-row">
                                    <div>
                                        <label className="admin-dish-input-label">GIÁ BÁN (VNĐ)</label>
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={e => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                                            className="admin-dish-input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="admin-dish-input-label">TRẠNG THÁI HIỂN THỊ</label>
                                        <div className="admin-dish-radio-group">
                                            <label className="admin-dish-radio-label">
                                                <input
                                                    type="radio"
                                                    name="visibility"
                                                    checked={formData.isHidden === false}
                                                    onChange={() => setFormData({...formData, isHidden: false})}
                                                /> 🟢 Hiển thị
                                            </label>
                                            <label className="admin-dish-radio-label">
                                                <input
                                                    type="radio"
                                                    name="visibility"
                                                    checked={formData.isHidden === true}
                                                    onChange={() => setFormData({...formData, isHidden: true})}
                                                /> 🔴 Ẩn khỏi menu
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="admin-dish-input-label">MÔ TẢ CHI TIẾT</label>
                                    <textarea
                                        rows={4}
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        className="admin-dish-textarea-field"
                                    />
                                </div>

                                <div>
                                    <label className="admin-dish-input-label">ĐƯỜNG DẪN HÌNH ANH (URL)</label>
                                    <div className="admin-dish-url-group">
                                        <input
                                            type="text"
                                            value={formData.imageUrl}
                                            onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                                            className="admin-dish-input-field"
                                        />
                                        <button type="button" className="admin-dish-upload-btn">Tải lên</button>
                                    </div>
                                </div>
                            </div>

                            <div className="admin-dish-form-actions">
                                <button type="button" onClick={() => setActiveModal('NONE')} className="admin-dish-btn-secondary">
                                    HỦY
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`admin-dish-btn-primary ${isSubmitting ? 'loading' : ''}`}
                                >
                                    {isSubmitting ? '⏳ ĐANG LƯU...' : '💾 CẬP NHẬT'}
                                </button>
                            </div>
                        </div>

                        <div className="admin-dish-modal-right">
                            <div>
                                <div className="admin-dish-preview-header">XEM TRƯỚC HIỂN THỊ CHUẨN</div>
                                <div className="admin-dish-preview-body">
                                    {/* Thay thế phần này */}
                                    <div className="admin-dish-preview-image">
                                        <img
                                            src={formData.imageUrl ?
                                                (formData.imageUrl.startsWith('http') ? formData.imageUrl : `/image/${formData.imageUrl}`)
                                                : 'https://placehold.co/300x200?text=No+Image'
                                            }
                                            alt="Preview"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://placehold.co/300x200?text=No+Image'
                                            }}
                                        />
                                    </div>
                                    <div className="admin-dish-preview-info">
                                        <span className="admin-dish-preview-status"></span>
                                    </div>
                                </div>
                            </div>

                            <div className="admin-dish-danger-zone">
                                <h5>🚨 KHU VỰC NGUY HIỂM</h5>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveModal('DELETE');
                                    }}
                                    className="admin-dish-btn-danger-full"
                                >
                                    XÓA MÓN ĂN KHỎI MENU
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* ========================================================= */}
            {/* DELETE MODAL */}
            {/* ========================================================= */}
            {activeModal === 'DELETE' && selectedDish && (
                <div className="admin-dish-modal-backdrop">
                    <div className="admin-dish-modal admin-dish-modal-delete">
                        <div className="admin-dish-delete-icon">⚠️</div>
                        <h3 className="admin-dish-delete-title">XÓA MÓN ĂN</h3>
                        <p className="admin-dish-delete-text">
                            Bạn có chắc chắn muốn xóa món ăn <strong>“{selectedDish.name}”</strong>?
                            Hành động gỡ bỏ này không thể hoàn tác.
                        </p>
                        <div className="admin-dish-delete-actions">
                            <button onClick={handleDeleteDish} className="admin-dish-btn-danger-modal">
                                Xác nhận xóa
                            </button>
                            <button onClick={() => setActiveModal('NONE')} className="admin-dish-btn-secondary">
                                Hủy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
