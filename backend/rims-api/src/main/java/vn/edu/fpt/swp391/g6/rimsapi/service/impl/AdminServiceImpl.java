package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.CreateCategoryRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.CreateDishRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.UpdateCategoryRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.UpdateDishRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.CategoryResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.MenuDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.*;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Category;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Dish;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Invoice;
import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderShift;
import vn.edu.fpt.swp391.g6.rimsapi.enums.PaymentMethod;
import vn.edu.fpt.swp391.g6.rimsapi.exception.BusinessRuleException;
import vn.edu.fpt.swp391.g6.rimsapi.exception.ResourceNotFoundException;
import vn.edu.fpt.swp391.g6.rimsapi.repository.CategoryRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.DishRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.InvoiceRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.RestaurantTableRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.projection.BestSellingDishProjection;
import vn.edu.fpt.swp391.g6.rimsapi.repository.projection.DailyRevenueProjection;
import vn.edu.fpt.swp391.g6.rimsapi.service.AdminService;

@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService
{
    private final DishRepository dishRepository; // line ~50
    private final CategoryRepository categoryRepository; // line ~260
    private final InvoiceRepository invoiceRepository; // line ~470 (invoice) / line ~540 (revenue report)
    private final RestaurantTableRepository restaurantTableRepository; // line ~455 (table) / line ~410 (menu)
    private final SimpMessagingTemplate messagingTemplate;

    // DISH SERVICE

    @Override
    @Transactional(readOnly = true)
    public List<DishResponse> getAllDishes()
    {
        return dishRepository.findAll().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<DishResponse> getDishesByCategory(Integer categoryId)
    {
        // Kiểm tra category tồn tại
        if (!categoryRepository.existsById(categoryId))
        {
            throw new ResourceNotFoundException("Không tìm thấy danh mục với ID: " + categoryId);
        }
        return dishRepository.findByCategoryId(categoryId).stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<DishResponse> getAvailableDishes()
    {
        return dishRepository.findByIsAvailableTrue().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public DishResponse getDishById(Integer id)
    {
        Dish dish = dishRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy món ăn với ID: " + id));
        return convertToResponse(dish);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DishResponse> searchDishes(String keyword)
    {
        if (keyword == null || keyword.trim().isEmpty())
        {
            return getAllDishes();
        }
        return dishRepository.searchByName(keyword).stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public DishResponse createDish(CreateDishRequest createDishRequest)
    {
        // Kiểm tra tên món ăn đã tồn tại chưa
        if (dishRepository.existsByName(createDishRequest.getName()))
        {
            throw new IllegalArgumentException("Tên món ăn '" + createDishRequest.getName() + "' đã tồn tại");
        }

        // Tìm category theo ID
        Category category = categoryRepository.findById(createDishRequest.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy danh mục với ID: " + createDishRequest.getCategoryId()));

        // Tạo mới món ăn
        Dish dish = new Dish();
        dish.setName(createDishRequest.getName());
        dish.setDescription(createDishRequest.getDescription());
        dish.setPrice(createDishRequest.getPrice());
        dish.setImageUrl(createDishRequest.getImageUrl());
        dish.setAvailable(createDishRequest.getIsAvailable() != null ? createDishRequest.getIsAvailable() : true);
        dish.setHidden(createDishRequest.getIsHidden() != null ? createDishRequest.getIsHidden() : false);
        dish.setCategory(category);

        Dish savedDish = dishRepository.save(dish);
        return convertToResponse(savedDish);

    }

    @Override
    @Transactional
    public DishResponse updateDish(Integer id, UpdateDishRequest updateDishRequest)
    {
        // Tìm món ăn cần update
        Dish dish = dishRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy món ăn với ID: " + id));

        // Kiểm tra tên mới có bị trùng không (bỏ qua chính nó)
        if (!dish.getName().equals(updateDishRequest.getName())
                && dishRepository.existsByNameAndIdNot(updateDishRequest.getName(), id))
        {
            throw new IllegalArgumentException("Tên món ăn '" + updateDishRequest.getName() + "' đã tồn tại!");
        }

        // Cập nhật thông tin
        dish.setName(updateDishRequest.getName());
        dish.setDescription(updateDishRequest.getDescription());

        if (updateDishRequest.getPrice() != null)
        {
            dish.setPrice(updateDishRequest.getPrice());
        }

        dish.setImageUrl(updateDishRequest.getImageUrl());

        // Cập nhật trạng thái nếu có
        if (updateDishRequest.getIsAvailable() != null)
        {
            dish.setAvailable(updateDishRequest.getIsAvailable());
        }

        boolean hiddenChanged = false;
        if (updateDishRequest.getIsHidden() != null
                && !updateDishRequest.getIsHidden().equals(dish.isHidden()))
        {
            dish.setHidden(updateDishRequest.getIsHidden());
            hiddenChanged = true;
        }

        // Cập nhật category nếu có thay đổi
        if (updateDishRequest.getCategoryId() != null)
        {
            Category category = categoryRepository.findById(updateDishRequest.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Không tìm thấy danh mục với ID: " + updateDishRequest.getCategoryId()));
            dish.setCategory(category);
        }

        Dish updatedDish = dishRepository.save(dish);

        if (hiddenChanged)
        {
            broadcastMenuVisibilityChanged(updatedDish);
        }

        return convertToResponse(updatedDish);

    }

    @Override
    @Transactional
    public void deleteDish(Integer id)
    {
        // 1. Kiểm tra món ăn có tồn tại trong hệ thống không
        Dish dish = dishRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy món ăn với ID: " + id));

        // 2. Kiểm tra xem món ăn đã từng phát sinh trong bất kỳ đơn hàng nào chưa (kể cả đơn đã hủy)
        long orderCount = dishRepository.countOrderItemsByDishId(id);

        if (orderCount == 0)
        {
            // Món mới tạo, chưa từng nằm trong order_items -> Cho phép xóa hẳn khỏi DB
            dishRepository.delete(dish);
        } else
        {
            // Món đã từng được đặt -> Không cho xóa, bắt dùng "Tạm dừng" thay thế
            throw new IllegalStateException(
                    "Món ăn đã phát sinh đơn hàng, không thể xóa. Vui lòng dùng chức năng \"Tạm dừng\" để ẩn món khỏi menu.");
        }

    }

    // CATEGORY SERVICE

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponse> getAllCategories()
    {
        return categoryRepository.findAll().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponse> getAvailableCategories()
    {
        return categoryRepository.findByIsAvailableTrue().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CategoryResponse getCategoryById(Integer id)
    {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy category với ID: " + id));
        return convertToResponse(category);
    }

    @Override
    @Transactional
    public CategoryResponse createCategory(CreateCategoryRequest createCategoryRequest)
    {
        if (categoryRepository.existsByName(createCategoryRequest.getName()))
        {
            throw new IllegalArgumentException(
                    "Tên danh mục '" + createCategoryRequest.getName() + "' đã tồn tại!");
        }

        Category category = new Category();
        category.setName(createCategoryRequest.getName());
        category.setDescription(createCategoryRequest.getDescription());
        category.setAvailable(true);

        Category savedCategory = categoryRepository.save(category);
        return convertToResponse(savedCategory);

    }

    @Override
    @Transactional
    public CategoryResponse updateCategory(Integer id, UpdateCategoryRequest updateCategoryRequest)
    {
        // 1. Tìm category cần update
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy category với ID: " + id));

        // 2. Kiểm tra tên mới có bị trùng không (bỏ qua chính nó)
        if (!category.getName().equals(updateCategoryRequest.getName())
                && categoryRepository.existsByName(updateCategoryRequest.getName()))
        {
            throw new IllegalArgumentException(
                    "Tên danh mục '" + updateCategoryRequest.getName() + "' đã tồn tại!");
        }

        // 3. Cập nhật thông tin cơ bản
        category.setName(updateCategoryRequest.getName());
        category.setDescription(updateCategoryRequest.getDescription());

        // 4. Xử lý cập nhật trạng thái
        if (updateCategoryRequest.getIsAvailable() != null)
        {
            boolean newStatus = updateCategoryRequest.getIsAvailable();
            boolean oldStatus = category.isAvailable();

            // ✅ LOGIC 1: Khi ẩn category -> tự động ẩn tất cả dishes trong category đó
            if (oldStatus && !newStatus)
            {
                List<Dish> dishesInCategory = dishRepository.findByCategoryId(id);

                if (!dishesInCategory.isEmpty())
                {
                    // Ẩn tất cả dishes trong category
                    for (Dish dish : dishesInCategory)
                    {
                        dish.setAvailable(false);
                        dish.setHidden(true);
                    }
                    dishRepository.saveAll(dishesInCategory);

                    // Broadcast cho từng dish bị ẩn
                    for (Dish dish : dishesInCategory)
                    {
                        broadcastMenuVisibilityChanged(dish);
                    }
                }
            }

            // Cập nhật trạng thái category
            category.setAvailable(newStatus);
        }

        // 5. Lưu category
        Category updatedCategory = categoryRepository.save(category);

        return convertToResponse(updatedCategory);

    }
    @Override
    @Transactional
    public void deleteCategory(Integer id)
    {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục với ID: " + id));

        // Lấy tất cả dishes thuộc category này
        List<Dish> dishesInCategory = dishRepository.findByCategoryId(id);

        // ✅ SỬA PHẦN NÀY: Kiểm tra xem có dish nào đã có order không
        boolean hasDishWithOrders = false;
        for (Dish dish : dishesInCategory)
        {
            long orderCount = dishRepository.countOrderItemsByDishId(dish.getId());
            if (orderCount > 0)
            {
                hasDishWithOrders = true;
                break;
            }
        }

        // ✅ LOGIC MỚI: Nếu có bất kỳ dish nào đã có order -> KHÔNG cho xóa
        if (hasDishWithOrders)
        {
            throw new IllegalStateException(
                    "Không thể xóa danh mục này vì có món ăn đã phát sinh đơn hàng. " +
                            "Vui lòng dùng chức năng \"Tạm dừng\" để ẩn danh mục.");
        }

        // ✅ LOGIC MỚI: Nếu không có dish nào có order -> Xóa cứng (xóa cả category và dishes)
        // Xóa tất cả dishes trong category trước (do FK constraint)
        if (!dishesInCategory.isEmpty())
        {
            dishRepository.deleteAll(dishesInCategory);
        }

        // Sau đó xóa category
        categoryRepository.delete(category);

    }

    // MENU DASHBOARD
    @Override
    @Transactional(readOnly = true)
    public MenuDashboardResponse getMenuDashboardData()
    {
        long totalDishes = dishRepository.count();
        long totalCategories = categoryRepository.count();

        // SỬA: Tính số món bị ẩn (isHidden = true) thay vì isAvailable = false
        long totalHiddenDishes = dishRepository.countByIsHidden(true);

        // SỬA: Chỉ lấy 4 món mới nhất ĐANG HIỂN THỊ (isHidden = false)
        var latestDishes = dishRepository.findTop4ByIsHiddenFalseOrderByCreatedAtDesc().stream()
                .map(dish -> MenuDashboardResponse.DishSummaryResponse.builder()
                        .id(dish.getId())
                        .name(dish.getName())
                        .categoryName(dish.getCategory().getName())
                        .price((double) dish.getPrice())
                        .imageUrl(dish.getImageUrl())
                        .status(dish.isHidden() ? "HIDDEN" : "AVAILABLE") // SỬA: dùng isHidden
                        .build())
                .collect(Collectors.toList());

        var categoryStats = dishRepository.getCategoryStatistics().stream()
                .map(result -> {
                    Boolean isCategoryAvailable = (Boolean) result[1];
                    return MenuDashboardResponse.CategoryStatResponse.builder()
                            .categoryName((String) result[0])
                            .status(isCategoryAvailable != null && isCategoryAvailable ? "ACTIVE" : "HIDDEN")
                            .dishCount((Long) result[2])
                            .build();
                })
                .collect(Collectors.toList());

        return MenuDashboardResponse.builder()
                .totalDishes(totalDishes)
                .totalCategories(totalCategories)
                .totalPausedDishes(totalHiddenDishes) // SỬA: đồng bộ với frontend
                .totalHiddenDishes(totalHiddenDishes) // SỬA: tính đúng giá trị
                .latestDishes(latestDishes)
                .categoryStats(categoryStats)
                .build();
    }

    // INVOICE SERVICE

    @Override
    @Transactional(readOnly = true)
    public InvoiceHistoryPageResponse getInvoiceHistory(
            int page, int pageSize,
            String tableNumber, String paymentMethod,
            String keyword, String customerKeyword)
    {
        int requestedPage = Math.max(page, 1);
        int requestedPageSize = Math.clamp(pageSize, 1, 50);

        String normalizedTableNumber = normalizeFilter(tableNumber);
        String normalizedKeyword = normalizeFilter(keyword);
        String normalizedCustomerKeyword = normalizeFilter(customerKeyword);

        PaymentMethod normalizedPaymentMethod = null;
        String trimmedMethod = normalizeFilter(paymentMethod);

        if (trimmedMethod != null && !"ALL".equalsIgnoreCase(trimmedMethod))
        {
            try
            {
                normalizedPaymentMethod = PaymentMethod.valueOf(trimmedMethod.toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex)
            {
                throw new IllegalArgumentException("Phương thức thanh toán không hợp lệ: " + paymentMethod);
            }
        }

        Page<InvoiceHistoryResponse> historyPage = invoiceRepository
                .getInvoiceHistory(
                        normalizedTableNumber,
                        normalizedPaymentMethod,
                        normalizedKeyword,
                        normalizedCustomerKeyword,
                        PageRequest.of(requestedPage - 1, requestedPageSize))
                .map(row -> new InvoiceHistoryResponse(
                        row.getInvoiceId(),
                        row.getOrderId(),
                        row.getTableNumber(),
                        row.getPaymentMethod(),
                        row.getAmount(),
                        row.getPaymentDate()));

        return new InvoiceHistoryPageResponse(
                historyPage.getContent(),
                requestedPage,
                requestedPageSize,
                historyPage.getTotalElements(),
                historyPage.getTotalPages());
    }

    private String normalizeFilter(String value)
    {
        if (value == null)
        {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Override
    @Transactional(readOnly = true)
    public InvoiceDetailResponse getInvoiceDetail(Long invoiceId)
    {

        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy hóa đơn"));

        InvoiceDetailResponse response = new InvoiceDetailResponse();

        response.setInvoiceId(invoice.getId());
        response.setOrderId(invoice.getOrder().getId());
        response.setTableNumber(invoice.getOrder().getTable().getTableNumber());
        response.setFinalAmount(invoice.getFinalAmount());
        response.setInvoiceDate(invoice.getInvoiceDate());

        response.setPaymentMethod(invoice.getPayments().isEmpty()
                ? "Không xác định"
                : invoice.getPayments().getFirst().getPaymentMethod().name());

        List<InvoiceItemResponse> items = invoice.getOrder().getOrderItems().stream().map(orderItem -> {
            InvoiceItemResponse item = new InvoiceItemResponse();

            item.setDishName(orderItem.getDish().getName());
            item.setQuantity(orderItem.getQuantity());
            item.setUnitPrice(orderItem.getUnitPrice());
            item.setAmount(orderItem.getSubTotal());

            return item;
        }).toList();

        response.setItems(items);

        // Tính tạm tính = tổng subTotal các món
        BigDecimal totalBeforeVat = invoice.getOrder().getOrderItems().stream()
                .map(oi -> oi.getSubTotal() != null ? oi.getSubTotal() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        response.setTotalBeforeVat(totalBeforeVat);

        // Tính VAT = finalAmount - totalBeforeVat
        BigDecimal vatAmount = invoice.getFinalAmount().subtract(totalBeforeVat);
        response.setVatAmount(vatAmount);

        // Số tiền khách trả (lấy từ payment đầu tiên)
        BigDecimal amountPaid = invoice.getPayments().isEmpty()
                ? invoice.getFinalAmount()
                : invoice.getPayments().getFirst().getAmount();
        response.setAmountPaid(amountPaid);

        // Tiền thừa = khách trả - thành tiền (nếu > 0)
        BigDecimal excessAmount = amountPaid.subtract(invoice.getFinalAmount());
        if (excessAmount.compareTo(BigDecimal.ZERO) < 0)
        {
            excessAmount = BigDecimal.ZERO;
        }
        response.setExcessAmount(excessAmount);

        return response;
    }

    // REVENUE SERVICE

    @Override
    @Transactional(readOnly = true)
    public RevenueReportResponse getTotalRevenue()
    {
        BigDecimal revenue = invoiceRepository.getTotalRevenue();
        return new RevenueReportResponse(revenue, "Tất cả");
    }

    @Override
    @Transactional(readOnly = true)
    public RevenueReportResponse getTodayRevenue()
    {
        LocalDate today = LocalDate.now();
        return getRevenueBetween(today, today);
    }

    @Override
    @Transactional(readOnly = true)
    public RevenueReportResponse getWeeklyRevenue()
    {
        LocalDate now = LocalDate.now();
        LocalDate startWeek = now.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return getRevenueBetween(startWeek, now);
    }

    @Override
    @Transactional(readOnly = true)
    public RevenueReportResponse getMonthlyRevenue()
    {
        LocalDate now = LocalDate.now();
        LocalDate startMonth = now.withDayOfMonth(1);

        return getRevenueBetween(startMonth, now);
    }

    @Override
    @Transactional(readOnly = true)
    public RevenueReportResponse getYearlyRevenue()
    {
        LocalDate now = LocalDate.now();
        LocalDate startYear = now.withDayOfYear(1);

        return getRevenueBetween(startYear, now);
    }

    @Override
    @Transactional(readOnly = true)
    public RevenueReportResponse getRevenueBetween(LocalDate fromDate, LocalDate toDate)
    {
        LocalDate today = LocalDate.now();

        //Don't allow future dates
        if (toDate.isAfter(today))
        {
            toDate = today;
        }

        // Validate date range
        if (fromDate.isAfter(toDate))
        {
            throw new BusinessRuleException("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc");
        }

        LocalDateTime start = fromDate.atStartOfDay();
        LocalDateTime end = toDate.atTime(23, 59, 59);
        BigDecimal revenue = invoiceRepository.getRevenueBetween(start, end);
        return new RevenueReportResponse(revenue, fromDate + " - " + toDate);
    }

    @Override
    @Transactional(readOnly = true)
    public WeeklyRevenueChartResponse getDailyRevenue(LocalDate fromDate, LocalDate toDate)
    {
        LocalDate today = LocalDate.now();

        if (toDate.isAfter(today))
        {
            toDate = today;
        }

        if (fromDate.isAfter(toDate))
        {
            throw new BusinessRuleException("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc");
        }

        LocalDateTime start = fromDate.atStartOfDay();
        LocalDateTime end = toDate.atTime(23, 59, 59);

        List<DailyRevenueProjection> rows = invoiceRepository.getDailyRevenueBetween(start, end);
        Map<LocalDate, BigDecimal> revenueByDate = new HashMap<>();

        for (DailyRevenueProjection row : rows)
        {
            if (row.getRevenueDate() == null)
            {
                continue;
            }

            revenueByDate.put(row.getRevenueDate(), row.getRevenue() == null ? BigDecimal.ZERO : row.getRevenue());
        }

        List<DailyRevenueItemResponse> items = new ArrayList<>();
        LocalDate currentDate = fromDate;
        while (!currentDate.isAfter(toDate))
        {
            items.add(new DailyRevenueItemResponse(
                    getDayLabel(currentDate.getDayOfWeek()),
                    currentDate,
                    revenueByDate.getOrDefault(currentDate, BigDecimal.ZERO)));

            currentDate = currentDate.plusDays(1);
        }

        return new WeeklyRevenueChartResponse(fromDate, toDate, items);
    }

    @Override
    @Transactional(readOnly = true)
    public BestSellingReportResponse getBestSellingReport(LocalDate fromDate, LocalDate toDate, Integer categoryId)
    {
        LocalDate today = LocalDate.now();

        if (toDate.isAfter(today))
        {
            toDate = today;
        }

        if (fromDate.isAfter(toDate))
        {
            throw new BusinessRuleException("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc");
        }

        LocalDateTime start = fromDate.atStartOfDay();
        LocalDateTime end = toDate.atTime(23, 59, 59);
        Pageable top10 = PageRequest.of(0, 10);

        List<BestSellingDishProjection> result = invoiceRepository.getBestSellingDishes(start, end, categoryId, top10);

        List<BestSellingDishItemResponse> items = new ArrayList<>();

        int rank = 1;

        for (BestSellingDishProjection row : result)
        {
            items.add(
                    new BestSellingDishItemResponse(
                            rank++,
                            row.getDishName(),
                            row.getImageUrl(),
                            row.getTotalQuantity(),
                            row.getTotalRevenue()));
        }

        return new BestSellingReportResponse(fromDate, toDate, "Khoảng thời gian đã chọn", items);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderShiftReportResponse getOrderShiftReport(LocalDate fromDate, LocalDate toDate)
    {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        if (toDate.isAfter(today))
        {
            toDate = today;
        }

        if (fromDate.isAfter(toDate))
        {
            throw new BusinessRuleException("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc");
        }

        LocalDateTime start = fromDate.atStartOfDay();

        LocalDateTime end = toDate.isEqual(today) ? now : toDate.atTime(23, 59, 59);

        List<LocalDateTime> paidOrderCreatedTimes = invoiceRepository.getPaidOrderCreatedTimesBetween(start, end);

        Map<OrderShift, Long> orderCountByShift = new EnumMap<>(OrderShift.class);

        for (OrderShift shift : OrderShift.values())
        {
            orderCountByShift.put(shift, 0L);
        }

        for (LocalDateTime createdAt : paidOrderCreatedTimes)
        {
            OrderShift shift = findOrderShift(createdAt.toLocalTime());

            if (shift != null)
            {
                orderCountByShift.compute(shift, (key, value) -> value + 1L);
            }
        }

        long totalPaidOrders = paidOrderCreatedTimes.size();
        long days = ChronoUnit.DAYS.between(fromDate, toDate) + 1;
        BigDecimal averageOrdersPerDay = BigDecimal.valueOf(totalPaidOrders)
                .divide(BigDecimal.valueOf(days), 1, RoundingMode.HALF_UP);

        OrderShift highestShift = findHighestOrderShift(orderCountByShift);
        long highestShiftOrderCount = orderCountByShift.get(highestShift);

        List<OrderShiftItemResponse> shifts = buildOrderShiftItems(orderCountByShift, totalPaidOrders);

        return new OrderShiftReportResponse(fromDate, toDate, totalPaidOrders, averageOrdersPerDay,
                new HighestOrderShiftResponse(
                        highestShift.getShiftName(),
                        highestShift.getDisplayName(),
                        highestShift.getStartTime(),
                        highestShift.getEndTime(),
                        highestShiftOrderCount,
                        calculatePercentage(highestShiftOrderCount, totalPaidOrders)),
                shifts);
    }

    // Helper

    private DishResponse convertToResponse(Dish dish)
    {
        DishResponse response = new DishResponse();
        response.setId(dish.getId());
        response.setName(dish.getName());
        response.setDescription(dish.getDescription());
        response.setPrice(dish.getPrice());
        response.setIsAvailable(dish.isAvailable());
        response.setIsHidden(dish.isHidden());
        response.setImageUrl(dish.getImageUrl());
        response.setCreatedAt(dish.getCreatedAt());
        response.setUpdatedAt(dish.getUpdatedAt());

        if (dish.getCategory() != null)
        {
            response.setCategoryId(dish.getCategory().getId());
            response.setCategoryName(dish.getCategory().getName());
        }

        return response;
    }

    private CategoryResponse convertToResponse(Category category)
    {
        CategoryResponse response = new CategoryResponse();
        response.setId(category.getId());
        response.setName(category.getName());
        response.setDescription(category.getDescription());
        response.setIsAvailable(category.isAvailable());
        response.setCreatedAt(category.getCreatedAt());
        response.setUpdatedAt(category.getUpdatedAt());
        return response;
    }

    private OrderShift findOrderShift(LocalTime time)
    {
        for (OrderShift shift : OrderShift.values())
        {
            if (shift.contains(time))
            {
                return shift;
            }
        }

        return null;
    }

    private List<OrderShiftItemResponse> buildOrderShiftItems(Map<OrderShift, Long> orderCountByShift,
            long totalPaidOrders)
    {
        List<OrderShiftItemResponse> shifts = new ArrayList<>();

        for (OrderShift shift : OrderShift.values())
        {
            long orderCount = orderCountByShift.get(shift);

            shifts.add(new OrderShiftItemResponse(
                    shift.getShiftName(),
                    shift.getDisplayName(),
                    shift.getStartTime(),
                    shift.getEndTime(),
                    orderCount,
                    calculatePercentage(orderCount, totalPaidOrders)));
        }
        return shifts;
    }

    private OrderShift findHighestOrderShift(Map<OrderShift, Long> orderCountByShift)
    {
        OrderShift highestShift = OrderShift.MORNING;

        for (OrderShift shift : OrderShift.values())
        {
            if (orderCountByShift.get(shift) > orderCountByShift.get(highestShift))
            {
                highestShift = shift;
            }
        }

        return highestShift;
    }

    private BigDecimal calculatePercentage(long orderCount, long totalPaidOrders)
    {
        if (totalPaidOrders == 0)
        {
            return BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP);
        }

        return BigDecimal.valueOf(orderCount).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(totalPaidOrders), 1, RoundingMode.HALF_UP);
    }

    private String getDayLabel(DayOfWeek dayOfWeek)
    {
        return switch (dayOfWeek)
        {
            case MONDAY -> "T2";
            case TUESDAY -> "T3";
            case WEDNESDAY -> "T4";
            case THURSDAY -> "T5";
            case FRIDAY -> "T6";
            case SATURDAY -> "T7";
            case SUNDAY -> "CN";
        };
    }
    private void broadcastMenuVisibilityChanged(Dish dish)
    {
        String payload = String.format(
                "{\"type\":\"MENU_VISIBILITY_CHANGED\",\"dishId\":%d,\"hidden\":%b}",
                dish.getId(), dish.isHidden());
        messagingTemplate.convertAndSend("/topic/waiter", payload);
        messagingTemplate.convertAndSend("/topic/kitchen", payload);
    }

}
