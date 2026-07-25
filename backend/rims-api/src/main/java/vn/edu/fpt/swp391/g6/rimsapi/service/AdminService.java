package vn.edu.fpt.swp391.g6.rimsapi.service;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.CreateCategoryRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.CreateDishRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.UpdateCategoryRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.UpdateDishRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.CategoryResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.MenuDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.*;

import java.time.LocalDate;
import java.util.List;


public interface AdminService
{
    // Dish service
    List<DishResponse> getAllDishes();

    List<DishResponse> getDishesByCategory(Integer categoryId);

    List<DishResponse> getAvailableDishes();

    DishResponse getDishById(Integer id);

    List<DishResponse> searchDishes(String keyword);

    DishResponse createDish(CreateDishRequest createDishRequest);

    DishResponse updateDish(Integer id, UpdateDishRequest updateDishRequest);

    void deleteDish(Integer id);

    // category service
    List<CategoryResponse> getAllCategories();

    List<CategoryResponse> getAvailableCategories();  // Chỉ lấy category đang hoạt động

    CategoryResponse getCategoryById(Integer id);

    CategoryResponse createCategory(CreateCategoryRequest createCategoryRequest);

    CategoryResponse updateCategory(Integer id, UpdateCategoryRequest updateCategoryRequest);

    void deleteCategory(Integer id);

    // menu dash board
    MenuDashboardResponse getMenuDashboardData();

    // invoice service
    InvoiceHistoryPageResponse getInvoiceHistory(
            int page, int pageSize,
            String tableNumber, String paymentMethod,
            String keyword, String customerKeyword);

    InvoiceDetailResponse getInvoiceDetail(Long invoiceId);

    // revenue service
    RevenueReportResponse getTotalRevenue();

    RevenueReportResponse getTodayRevenue();

    RevenueReportResponse getWeeklyRevenue();

    RevenueReportResponse getMonthlyRevenue();

    RevenueReportResponse getYearlyRevenue();

    RevenueReportResponse getRevenueBetween(LocalDate fromDate, LocalDate toDate);

    WeeklyRevenueChartResponse getDailyRevenue(LocalDate fromDate, LocalDate toDate);

    BestSellingReportResponse getBestSellingReport(LocalDate fromDate, LocalDate toDate, Integer categoryId);

    OrderShiftReportResponse getOrderShiftReport(LocalDate fromDate, LocalDate toDate);

}
