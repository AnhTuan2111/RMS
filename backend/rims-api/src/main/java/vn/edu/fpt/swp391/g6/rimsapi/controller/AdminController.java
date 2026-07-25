package vn.edu.fpt.swp391.g6.rimsapi.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.auth.UpdateProfileRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.CreateCategoryRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.CreateDishRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.UpdateCategoryRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.UpdateDishRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.user.CreateCustomerRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.user.CreateStaffRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.user.SetAccountStatusRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.user.UpdateAccountRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.common.PageResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.CategoryResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.MenuDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.*;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserProfileResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserResponse;
import vn.edu.fpt.swp391.g6.rimsapi.service.AdminService;
import vn.edu.fpt.swp391.g6.rimsapi.service.UserService;

import java.time.LocalDate;
import java.util.List;


@RestController
@RequestMapping("/rims/admin")
@RequiredArgsConstructor
public class AdminController
{

    private final UserService userService;
    private final AdminService adminService;
    // =================== USER / ACCOUNT ===================

    @GetMapping("/user/all")
    public List<UserResponse> getAllUsers()
    {
        return userService.getAllUsers();
    }

    @GetMapping("/user/staff")
    public PageResponse<UserResponse> getStaffAccounts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size)
    {
        return userService.getStaffAccounts(keyword, active, page, size);
    }

    @GetMapping("/user/customer")
    public PageResponse<UserResponse> getCustomerAccounts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size)
    {
        return userService.getCustomerAccounts(keyword, active, page, size);
    }

    @GetMapping("/user/{id}")
    public UserResponse getAccountDetail(@PathVariable Integer id)
    {
        return userService.getAccountDetail(id);
    }

    @PostMapping("/user/customer/new")
    public ResponseEntity<UserResponse> createCustomer(
            @RequestBody @Valid CreateCustomerRequest request)
    {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createCustomer(request));
    }

    @PostMapping("/user/staff/new")
    public ResponseEntity<UserResponse> createStaff(
            @RequestBody @Valid CreateStaffRequest request)
    {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createStaff(request));
    }

    @PutMapping("/user/{id}")
    public UserResponse updateAccount(
            @PathVariable Integer id,
            @RequestBody @Valid UpdateAccountRequest request)
    {
        return userService.updateAccount(id, request);
    }

    @PatchMapping("/user/{id}/status")
    public ResponseEntity<Void> setAccountStatus(
            @PathVariable Integer id,
            @RequestBody SetAccountStatusRequest request)
    {
        userService.setAccountStatus(id, request);
        return ResponseEntity.noContent().build();
    }

    // Legacy profile endpoints
    @GetMapping("/user/profile/{id}")
    public UserProfileResponse getProfile(@PathVariable Integer id)
    {
        return userService.getProfile(id);
    }

    @PutMapping("/user/profile/update/{id}")
    public UserProfileResponse updateProfile(
            @PathVariable Integer id,
            @RequestBody @Valid UpdateProfileRequest request)
    {
        return userService.updateProfile(id, request);
    }

    // =================== INVOICE ===================

    @GetMapping("/invoice/history")
    public InvoiceHistoryPageResponse getInvoiceHistory(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String tableNumber,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String customerKeyword)
    {
        return adminService.getInvoiceHistory(
                page,
                pageSize,
                tableNumber,
                paymentMethod,
                keyword,
                customerKeyword);
    }

    @GetMapping("/invoice/{invoiceId}")
    public InvoiceDetailResponse getInvoiceDetail(
            @PathVariable Long invoiceId)
    {
        return adminService.getInvoiceDetail(invoiceId);
    }

    // =================== REVENUE ===================

    @GetMapping("/revenue/total")
    public RevenueReportResponse getTotalRevenue()
    {
        return adminService.getTotalRevenue();
    }

    @GetMapping("/revenue/today")
    public RevenueReportResponse getTodayRevenue()
    {
        return adminService.getTodayRevenue();
    }

    @GetMapping("/revenue/weekly")
    public RevenueReportResponse getWeeklyRevenue()
    {
        return adminService.getWeeklyRevenue();
    }

    @GetMapping("/revenue/daily")
    public WeeklyRevenueChartResponse getDailyRevenue(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,

            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate)
    {
        return adminService.getDailyRevenue(
                fromDate,
                toDate);
    }

    @GetMapping("/revenue/monthly")
    public RevenueReportResponse getMonthlyRevenue()
    {
        return adminService.getMonthlyRevenue();
    }

    @GetMapping("/revenue/yearly")
    public RevenueReportResponse getYearlyRevenue()
    {
        return adminService.getYearlyRevenue();
    }

    @GetMapping("/revenue/custom")
    public RevenueReportResponse getCustomRevenue(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate)
    {
        return adminService.getRevenueBetween(fromDate, toDate);
    }

    @GetMapping("/revenue/best-selling")
    public BestSellingReportResponse getBestSellingReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,

            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,

            @RequestParam(required = false) Integer categoryId)
    {
        return adminService.getBestSellingReport(
                fromDate,
                toDate,
                categoryId);
    }

    @GetMapping("/revenue/order-shifts")
    public OrderShiftReportResponse getOrderShiftReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,

            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate)
    {
        return adminService
                .getOrderShiftReport(
                        fromDate,
                        toDate);
    }

    @GetMapping("/category/all")
    public ResponseEntity<List<CategoryResponse>> getAllCategories()
    {
        return ResponseEntity.ok(adminService.getAllCategories());
    }

    @GetMapping("/category/available")
    public ResponseEntity<List<CategoryResponse>> getAvailableCategories()
    {
        return ResponseEntity.ok(adminService.getAvailableCategories());
    }

    @GetMapping("/category/{id}")
    public ResponseEntity<CategoryResponse> getCategoryById(@PathVariable Integer id)
    {
        return ResponseEntity.ok(adminService.getCategoryById(id));
    }

    @PostMapping("/category/new")
    public ResponseEntity<CategoryResponse> createCategory(
            @RequestBody @Valid CreateCategoryRequest createCategoryRequest)
    {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createCategory(createCategoryRequest));
    }

    @PutMapping("/category/{id}")
    public ResponseEntity<CategoryResponse> updateCategory(
            @PathVariable Integer id,
            @RequestBody @Valid UpdateCategoryRequest updateCategoryRequest)
    {
        return ResponseEntity.ok(adminService.updateCategory(id, updateCategoryRequest));
    }

    @DeleteMapping("/category/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Integer id)
    {
        adminService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    // =================== DISH ===================

    @GetMapping("/dish/all")
    public ResponseEntity<List<DishResponse>> getAllDishes()
    {
        return ResponseEntity.ok(adminService.getAllDishes());
    }

    @GetMapping("/dish/category/{categoryId}")
    public ResponseEntity<List<DishResponse>> getDishesByCategory(@PathVariable Integer categoryId)
    {
        return ResponseEntity.ok(adminService.getDishesByCategory(categoryId));
    }

    @GetMapping("/dish/available")
    public ResponseEntity<List<DishResponse>> getAvailableDishes()
    {
        return ResponseEntity.ok(adminService.getAvailableDishes());
    }

    @GetMapping("/dish/search")
    public ResponseEntity<List<DishResponse>> searchDishes(@RequestParam(required = false) String keyword)
    {
        return ResponseEntity.ok(adminService.searchDishes(keyword));
    }

    @GetMapping("/dish/{id}")
    public ResponseEntity<DishResponse> getDishById(@PathVariable Integer id)
    {
        return ResponseEntity.ok(adminService.getDishById(id));
    }

    @PostMapping("/dish/new")
    public ResponseEntity<DishResponse> createDish(
            @RequestBody @Valid CreateDishRequest createDishRequest)
    {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createDish(createDishRequest));
    }

    @PutMapping("/dish/update/{id}")
    public ResponseEntity<DishResponse> updateDish(
            @PathVariable Integer id,
            @RequestBody @Valid UpdateDishRequest updateDishRequest)
    {
        return ResponseEntity.ok(adminService.updateDish(id, updateDishRequest));
    }

    @DeleteMapping("/dish/delete/{id}")
    public ResponseEntity<Void> deleteDish(@PathVariable Integer id)
    {
        adminService.deleteDish(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/menu")
    public ResponseEntity<MenuDashboardResponse> getMenuDashboard()
    {
        MenuDashboardResponse data = adminService.getMenuDashboardData();
        return ResponseEntity.ok(data);
    }

}
