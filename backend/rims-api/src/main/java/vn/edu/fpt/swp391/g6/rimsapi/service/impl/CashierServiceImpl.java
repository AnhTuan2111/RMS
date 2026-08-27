package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.Comparator;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.fpt.swp391.g6.rimsapi.config.VNPayConfig;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.payment.PaymentRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.OrderDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.OrderItemResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.payment.PaymentResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.payment.VNPayResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.CashierInvoiceDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.CashierInvoiceItemResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.CashierInvoiceSummaryResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.PagedInvoiceResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.table.TableDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.entity.*;
import vn.edu.fpt.swp391.g6.rimsapi.entity.OrderItem;
import vn.edu.fpt.swp391.g6.rimsapi.enums.*;
import vn.edu.fpt.swp391.g6.rimsapi.repository.*;
import vn.edu.fpt.swp391.g6.rimsapi.service.CashierService;
import vn.edu.fpt.swp391.g6.rimsapi.util.WebSocketBroadcaster;

@Service
@RequiredArgsConstructor
public class CashierServiceImpl implements CashierService
{

    private final OrderRepository orderRepository;
    private final RestaurantTableRepository tableRepository;
    private final InvoiceRepository invoiceRepository;
    private final VNPayConfig vnpayConfig;
    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;
    private final WebSocketBroadcaster webSocketBroadcaster;
    private final PasswordEncoder passwordEncoder;

    // Dashboard sơ đồ bàn cho Cashier: bàn nào đang có order SERVING/LOCKED -> hiển thị "đang phục vụ", còn lại "trống"
    @Override
    @Transactional(readOnly = true)
    public List<TableDashboardResponse> getTablesDashboard()
    {
        List<RestaurantTable> tables = tableRepository.findAll();
        List<Order> activeOrders = orderRepository.findByStatusIn(List.of(OrderStatus.SERVING, OrderStatus.LOCKED)); // ĐỔI: gộp cả LOCKED

        Map<Integer, Long> tableOrderMap = activeOrders.stream()
                .filter(o -> o.getTable() != null)
                .collect(Collectors.toMap(
                        o -> o.getTable().getId(),
                        Order::getId,
                        (existing, replacement) -> existing));

        return tables.stream()
                .map(t -> {
                    Long orderId = tableOrderMap.get(t.getId());
                    TableStatus cashierStatus = (orderId != null) ? TableStatus.SERVING : TableStatus.AVAILABLE;
                    return TableDashboardResponse.builder()
                            .tableId(t.getId())
                            .tableNumber(t.getTableNumber())
                            .status(cashierStatus)
                            .orderId(orderId)
                            .build();
                })
                .toList();
    }

    // Xem chi tiết đơn để chuẩn bị thanh toán: chỉ tính món COMPLETED, tự tính VAT 10%. Đây là API "xem trước", không đổi trạng thái.
    @Override
    @Transactional(readOnly = true)
    public OrderDetailResponse getOrderDetail(Long orderId)
    {
        Order order = orderRepository.findOrderWithDetailsById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng tương ứng"));

        // 1. Lọc danh sách OrderItem chỉ lấy món đã COMPLETED
        List<OrderItemResponse> itemResponses = order.getOrderItems().stream()
                .filter(oi -> oi.getStatus() == OrderItemStatus.COMPLETED)
                .map(oi -> OrderItemResponse.builder()
                        .orderItemId(oi.getId())
                        .dishName(oi.getDishNameSnapshot())
                        .quantity(oi.getQuantity())
                        .unitPrice(oi.getUnitPrice())
                        .subTotal(oi.getSubTotal())
                        .note(oi.getNote())
                        .build())
                .toList();

        // 2. Tính tổng tiền động dựa TRÊN CÁC MÓN COMPLETED
        BigDecimal totalBeforeVat = itemResponses.stream()
                .map(OrderItemResponse::getSubTotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal vatAmount = totalBeforeVat.multiply(new BigDecimal("0.10"));
        BigDecimal finalAmount = totalBeforeVat.add(vatAmount);

        return OrderDetailResponse.builder()
                .orderId(order.getId())
                .tableNumber(order.getTable() != null ? order.getTable().getTableNumber() : "N/A")
                .createdAt(order.getCreatedAt())
                .orderItems(itemResponses)
                .totalAmountBeforeVat(totalBeforeVat)
                .vatAmount(vatAmount)
                .finalAmount(finalAmount)
                .build();
    }

    // BƯỚC 1/2 của thanh toán: "chốt" đơn trước khi xử lý tiền thật.
    // LƯU Ý QUAN TRỌNG: hàm này KHÔNG dùng pessimistic lock (chỉ completeCashPayment mới lock thật) -> có race condition
    // nhỏ nếu 2 request gọi processPayment gần như đồng thời cho cùng 1 order.
    @Override
    @Transactional
    public PaymentResponse processPayment(Long orderId, PaymentRequest request)
    {
        Order order = orderRepository.findOrderWithDetailsById(orderId) // ĐỔI: cần load kèm orderItems
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));

        // Idempotent: nếu đã LOCKED sẵn (Cashier bấm lại/F5) thì trả về luôn, không làm gì thêm
        if (order.getStatus() == OrderStatus.LOCKED)
        {
            return PaymentResponse.builder()
                    .message("Đơn hàng đã được khóa từ trước. Sẵn sàng thanh toán!")
                    .success(true)
                    .build();
        }

        if (order.getStatus() != OrderStatus.SERVING)
        {
            throw new RuntimeException("Đơn hàng này đã thanh toán xong hoặc không tồn tại!");
        }

        List<OrderItem> items = order.getOrderItems() != null ? order.getOrderItems() : List.of();

        // MỚI: chặn nếu còn món chưa xử lý xong
        boolean hasPreparingItem = items.stream()
                .anyMatch(item -> item.getStatus() == OrderItemStatus.PREPARING);

        if (hasPreparingItem)
        {
            String preparingNames = items.stream()
                    .filter(item -> item.getStatus() == OrderItemStatus.PREPARING)
                    .map(item -> item.getDishNameSnapshot() + " x" + item.getQuantity())
                    .collect(Collectors.joining(", "));
            throw new IllegalArgumentException("Không thể thanh toán, còn món chưa hoàn thành: " + preparingNames); // ĐỔI: RuntimeException -> IllegalArgumentException để trả đúng mã 400
        }

        // QUAN TRỌNG - CASE ĐẶC BIỆT: không còn PREPARING nhưng cũng không có món nào COMPLETED
        // -> nghĩa là 100% món đã bị CANCELLED -> tự đóng đơn, KHÔNG tạo Invoice, giải phóng bàn luôn
        boolean hasCompletedItem = items.stream()
                .anyMatch(item -> item.getStatus() == OrderItemStatus.COMPLETED);

        if (!hasCompletedItem)
        {
            order.setStatus(OrderStatus.COMPLETED); // dùng lại giá trị enum có sẵn, không tạo Invoice
            orderRepository.save(order);
            releaseTableAfterOrderClose(order);

            return PaymentResponse.builder()
                    .message("Bàn không có món nào được hoàn thành, đơn đã được đóng và giải phóng bàn.")
                    .success(true)
                    .autoClosedNoPayment(true)
                    .build();
        }

        // Còn lại: có ít nhất 1 món COMPLETED -> khóa đơn, chờ completeCashPayment/createVNPayPaymentUrl xử lý tiếp
        order.setStatus(OrderStatus.LOCKED);
        order.setLockedAt(LocalDateTime.now());
        orderRepository.save(order);

        return PaymentResponse.builder()
                .message("Đã khóa đơn hàng. Sẵn sàng thanh toán")
                .success(true)
                .build();
    }

    // BƯỚC 2/2 (nhánh tiền mặt): xử lý tiền thật, dùng pessimistic lock vì đây là nơi ghi dữ liệu quan trọng nhất.
    // LƯU Ý: có 2 lần tính discount điểm - lần 1 (preview) chỉ để validate sớm "khách đưa đủ tiền chưa",
    // lần 2 (applyLoyaltyPoints) mới là tính + trừ điểm thật. Sửa rule tính điểm phải sửa khớp cả 2 chỗ.
    @Override
    @Transactional
    public PaymentResponse completeCashPayment(Long orderId, PaymentRequest request)
    {
        Order order = orderRepository.findOrderForUpdateWithItems(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));

        if (order.getStatus() != OrderStatus.LOCKED)
        {
            throw new RuntimeException("Đơn hàng chưa được chốt (LOCKED) hoặc đã thanh toán xong!");
        }

        BigDecimal totalBeforeVat = calculateActualTotal(order);
        BigDecimal vatAmount = totalBeforeVat.multiply(new BigDecimal("0.10"));
        BigDecimal finalAmount = totalBeforeVat.add(vatAmount);

        // MỚI: tính trước số tiền phải trả SAU khi trừ điểm dự kiến (chưa apply thật) để validate sớm
        Integer customerId = request.getCustomerId();
        Integer pointsUsed = request.getPointsUsed();
        BigDecimal previewDiscount = BigDecimal.ZERO;
        if (customerId != null && pointsUsed != null && pointsUsed > 0)
        {
            previewDiscount = new BigDecimal(pointsUsed).multiply(new BigDecimal("1000"));
        }
        BigDecimal previewFinalAmount = finalAmount.subtract(previewDiscount);
        if (previewFinalAmount.compareTo(BigDecimal.ZERO) < 0)
            previewFinalAmount = BigDecimal.ZERO;

        BigDecimal amountPaid = BigDecimal.valueOf(request.getAmountPaid());
        if (amountPaid.compareTo(previewFinalAmount) < 0)
        {
            throw new RuntimeException("Khách đưa thiếu tiền!");
        }

        Invoice invoice = new Invoice();
        finalAmount = applyLoyaltyPoints(invoice, customerId, pointsUsed, finalAmount); // tính + trừ/cộng điểm THẬT ở đây

        BigDecimal excessAmount = amountPaid.subtract(finalAmount);

        invoice.setOrder(order);
        invoice.setFinalAmount(finalAmount);
        invoice.setInvoiceDate(LocalDateTime.now());
        invoice.calculateAndSetRevenue(vatAmount);

        Payment payment = new Payment();
        payment.setAmount(amountPaid);
        payment.setPaymentMethod(PaymentMethod.CASH);
        payment.setSuccess(true);
        invoice.addPayment(payment);

        invoiceRepository.save(invoice);
        webSocketBroadcaster.broadcastAfterCommit("/topic/admin", "{\"type\":\"STATS_UPDATED\"}");
        order.setLockedAt(null);
        order.setStatus(OrderStatus.COMPLETED);
        orderRepository.save(order);

        releaseTableAfterOrderClose(order);

        return PaymentResponse.builder()
                .message("Thanh toán tiền mặt thành công")
                .success(true)
                .invoiceId(invoice.getId())
                .amountPaid(amountPaid)
                .excessAmount(excessAmount)
                .finalAmount(finalAmount)
                .customerName(invoice.getCustomer() != null ? invoice.getCustomer().getFullName() : null)
                .pointsUsed(invoice.getPointsUsedOnInvoice())
                .pointsEarned(invoice.getPointsEarnedOnInvoice())
                .paymentMethod("CASH")
                .build();
    }

    // Cashier bấm "Hủy" giữa chừng thanh toán: trả đơn LOCKED -> SERVING, dọn sạch dữ liệu tạm (pending fields, lockedAt)
    @Override
    @Transactional
    public PaymentResponse unlockOrder(Long orderId)
    {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));

        if (order.getStatus() == OrderStatus.LOCKED)
        {
            order.setStatus(OrderStatus.SERVING);
            order.setPendingCustomerId(null);
            order.setPendingPointsUsed(null);
            order.setLockedAt(null);
            orderRepository.save(order);

            return PaymentResponse.builder()
                    .message("Đã hủy quá trình thanh toán, bàn tiếp tục phục vụ.")
                    .success(true)
                    .build();
        }

        return PaymentResponse.builder()
                .message("Đơn hàng không ở trạng thái khóa.")
                .success(false)
                .build();
    }

    // Callback VNPay báo THẤT BẠI/hủy: chỉ mở khóa đơn, KHÔNG tạo Invoice, KHÔNG đụng điểm khách
    // (vì ở bước tạo URL, điểm mới chỉ bị trừ "tạm" trên số tiền hiển thị, chưa từng trừ thật vào customer.rewardPoints)
    @Override
    @Transactional
    public void processVnPayFailed(String vnpTxnRef)
    {
        String[] parts = vnpTxnRef.split("_");
        Long orderId = Long.parseLong(parts[1]);

        Order order = orderRepository.findById(orderId).orElse(null);

        if (order != null && order.getStatus() == OrderStatus.LOCKED)
        {
            order.setStatus(OrderStatus.SERVING);
            order.setPendingCustomerId(null);
            order.setPendingPointsUsed(null);
            order.setLockedAt(null);
            orderRepository.save(order);
        }
    }

    // BƯỚC 2 (nhánh VNPay - phần 1): tính tiền, trừ TẠM điểm (chỉ để ra số tiền hiển thị/gửi VNPay), sinh URL redirect + chữ ký HMAC-SHA512.
    // QUAN TRỌNG: lưu customerId/pointsUsed vào chính Order (pendingCustomerId/pendingPointsUsed) vì callback VNPay
    // là 1 request độc lập, không có session/context cũ - phải "nhớ" lựa chọn của khách bằng cách lưu vào DB.
    @Override
    @Transactional
    public VNPayResponse createVNPayPaymentUrl(Long orderId, Integer customerId, Integer pointsUsed)
    {
        Order order = orderRepository.findOrderWithDetailsById(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));

        if (order.getStatus() != OrderStatus.SERVING && order.getStatus() != OrderStatus.LOCKED)
        {
            throw new RuntimeException("Đơn hàng này đã thanh toán xong hoặc không hợp lệ!");
        }

        // ĐÃ SỬA: Lấy tổng tiền thực tế của các món COMPLETED
        BigDecimal totalBeforeVat = calculateActualTotal(order);

        if (totalBeforeVat == null || totalBeforeVat.compareTo(BigDecimal.ZERO) <= 0)
        {
            throw new RuntimeException("Đơn hàng chưa có món ăn hoàn thành (Tổng tiền = 0đ)!");
        }

        BigDecimal vatAmount = totalBeforeVat.multiply(new BigDecimal("0.10"));
        BigDecimal finalAmount = totalBeforeVat.add(vatAmount);

        // ĐÃ THÊM: Nếu khách chọn dùng điểm, trừ tạm vào số tiền phải trả qua VNPay
        // (chưa trừ/cộng điểm thật vào tài khoản khách — việc đó chỉ làm khi callback thành công)
        if (customerId != null)
        {
            User customer = userRepository.findById(customerId).orElse(null);
            if (customer != null && pointsUsed != null && pointsUsed > 0)
            {
                if (customer.getRewardPoints() < pointsUsed)
                {
                    throw new RuntimeException("Khách hàng không đủ điểm!");
                }
                BigDecimal discount = new BigDecimal(pointsUsed).multiply(new BigDecimal("1000"));
                BigDecimal maxDiscount = finalAmount.multiply(new BigDecimal("0.5"));
                if (discount.compareTo(maxDiscount) > 0)
                {
                    throw new RuntimeException("Số điểm sử dụng vượt quá 50% hóa đơn cho phép!");
                }
                finalAmount = finalAmount.subtract(discount);
                if (finalAmount.compareTo(BigDecimal.ZERO) < 0)
                    finalAmount = BigDecimal.ZERO;
            }
        }

        // ĐÃ THÊM: Lưu tạm customerId/pointsUsed vào Order để lấy lại lúc VNPay callback về
        order.setPendingCustomerId(customerId);
        order.setPendingPointsUsed(pointsUsed);
        order.setStatus(OrderStatus.LOCKED);
        order.setLockedAt(LocalDateTime.now());
        orderRepository.save(order);

        long amountVND = finalAmount.setScale(0, RoundingMode.HALF_UP).longValue() * 100;

        String vnp_TxnRef = "RIMS_" + order.getId() + "_" + System.currentTimeMillis();
        String ipAddress = "127.0.0.1";

        Map<String, String> vnp_Params = new HashMap<>();
        vnp_Params.put("vnp_Version", vnpayConfig.getVnpVersion());
        vnp_Params.put("vnp_Command", vnpayConfig.getVnpCommand());
        vnp_Params.put("vnp_TmnCode", vnpayConfig.getVnpTmnCode());
        vnp_Params.put("vnp_Amount", String.valueOf(amountVND));
        vnp_Params.put("vnp_CurrCode", "VND");
        vnp_Params.put("vnp_TxnRef", vnp_TxnRef);
        vnp_Params.put("vnp_OrderInfo", "Thanh toan don hang RIMS ID " + order.getId());
        vnp_Params.put("vnp_OrderType", "other");
        vnp_Params.put("vnp_Locale", "vn");
        vnp_Params.put("vnp_IpAddr", ipAddress);

        vnp_Params.put("vnp_ReturnUrl", "http://localhost:8080/rims/cashier/payments/vnpay-callback");

        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
        vnp_Params.put("vnp_CreateDate", now.format(formatter));

        // Sort tham số theo key (bắt buộc theo chuẩn VNPay) rồi build 2 chuỗi song song: hashData (để ký) và query (để redirect)
        Map<String, String> sortedParams = new TreeMap<>(vnp_Params);
        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();

        try
        {
            Iterator<Map.Entry<String, String>> itr = sortedParams.entrySet().iterator();
            while (itr.hasNext())
            {
                Map.Entry<String, String> entry = itr.next();
                String fieldName = entry.getKey();
                String fieldValue = entry.getValue();

                if ((fieldValue != null) && (!fieldValue.trim().isEmpty()))
                {
                    hashData.append(fieldName);
                    hashData.append('=');
                    hashData.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII));

                    query.append(URLEncoder.encode(fieldName, StandardCharsets.US_ASCII));
                    query.append('=');
                    query.append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII));

                    if (itr.hasNext())
                    {
                        query.append('&');
                        hashData.append('&');
                    }
                }
            }
        } catch (Exception e)
        {
            throw new RuntimeException("Lỗi mã hóa dữ liệu VNPay", e);
        }

        String queryUrl = query.toString();
        String vnp_SecureHash = vnpayConfig.hmacSHA512(vnpayConfig.getVnpHashSecret(), hashData.toString());
        queryUrl += "&vnp_SecureHash=" + vnp_SecureHash;

        String paymentUrl = vnpayConfig.getVnpUrl() + "?" + queryUrl;

        return new VNPayResponse(paymentUrl, "Sinh link thanh toán VNPay thành công!", true);
    }

    // BƯỚC 2 (nhánh VNPay - phần 2): callback khi VNPay báo THÀNH CÔNG.
    // Đây mới là nơi tạo Invoice thật + trừ/cộng điểm thật, dùng lại đúng applyLoyaltyPoints() như nhánh tiền mặt
    // để đảm bảo 2 kênh thanh toán tính điểm giống hệt nhau. Có lock (findOrderForUpdateWithItems) vì đây là bước ghi tiền thật.
    @Override
    @Transactional
    public Long processVnPaySuccess(String vnpTxnRef)
    {
        String[] parts = vnpTxnRef.split("_");
        Long orderId = Long.parseLong(parts[1]);

        Order order = orderRepository.findOrderForUpdateWithItems(orderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng từ VNPay"));

        // Chặn xử lý trùng nếu VNPay gọi callback nhiều hơn 1 lần cho cùng giao dịch
        if (order.getStatus() == OrderStatus.COMPLETED)
        {
            throw new RuntimeException("Đơn hàng này đã được thanh toán rồi!");
        }

        // ĐÃ SỬA: Tính lại VAT dựa trên tổng tiền thực tế của các món COMPLETED
        BigDecimal totalBeforeVat = calculateActualTotal(order);
        BigDecimal vatAmount = totalBeforeVat.multiply(new BigDecimal("0.10"));
        BigDecimal finalAmount = totalBeforeVat.add(vatAmount);

        Invoice invoice = new Invoice();

        // ĐÃ THÊM: Lấy lại customerId/pointsUsed đã lưu tạm lúc tạo link VNPay,
        // rồi áp dụng đúng logic trừ/cộng điểm y hệt luồng tiền mặt
        Integer customerId = order.getPendingCustomerId();
        Integer pointsUsed = order.getPendingPointsUsed();
        finalAmount = applyLoyaltyPoints(invoice, customerId, pointsUsed, finalAmount);

        // Dọn dẹp dữ liệu tạm sau khi đã dùng xong
        order.setPendingCustomerId(null);
        order.setPendingPointsUsed(null);

        invoice.setOrder(order);
        invoice.setFinalAmount(finalAmount);
        invoice.setInvoiceDate(java.time.LocalDateTime.now());

        invoice.calculateAndSetRevenue(vatAmount);

        Payment payment = new Payment();
        payment.setAmount(finalAmount);
        payment.setPaymentMethod(PaymentMethod.QRCODE);
        payment.setSuccess(true);
        invoice.addPayment(payment);

        invoiceRepository.save(invoice);
        webSocketBroadcaster.broadcastAfterCommit("/topic/admin", "{\"type\":\"STATS_UPDATED\"}");

        order.setLockedAt(null);
        order.setStatus(OrderStatus.COMPLETED);
        orderRepository.save(order);

        releaseTableAfterOrderClose(order);

        return invoice.getId();
    }

    // Tra cứu khách hàng theo SĐT - chỉ trả về nếu đúng role CUSTOMER (tránh nhầm tài khoản nhân viên có cùng SĐT)
    @Override
    @Transactional(readOnly = true)
    public User searchCustomerByPhone(String phone)
    {
        User user = userRepository.findByPhone(phone).orElse(null);
        if (user != null && user.getRole() == RoleType.CUSTOMER)
        {
            return user;
        }
        return null;
    }

    // Tạo nhanh tài khoản khách vãng lai ngay tại quầy: username = phone, mật khẩu mặc định "123456" (đã mã hóa BCrypt)
    @Override
    @Transactional
    public User createCustomerFast(String fullName, String phone, String email)
    {
        if (userRepository.existsByPhone(phone))
        {
            throw new RuntimeException("Số điện thoại này đã tồn tại!");
        }
        User user = new User();
        user.setFullName(fullName);
        user.setPhone(phone);
        user.setEmail(email != null && !email.isEmpty() ? email : phone + "@rims.com");
        user.setUsername(phone);
        user.setPasswordHash(passwordEncoder.encode("123456"));
        user.setRole(RoleType.CUSTOMER);
        user.setRewardPoints(0);
        user.setActive(true);

        try
        {
            return userRepository.save(user);
        } catch (DataIntegrityViolationException e)
        {
            // Bắt trường hợp race condition: 2 request cùng tạo 1 SĐT gần như đồng thời,
            // request đầu đã pass check existsByPhone nhưng request thứ 2 mới thực sự save trước.
            // DB tự chặn nhờ unique constraint trên cột phone — chuyển thành message thân thiện.
            throw new RuntimeException("Số điện thoại này đã tồn tại!");
        }
    }

    // Danh sách hóa đơn HÔM NAY cho Cashier, có filter theo bàn/từ khóa khách/phương thức/mã HĐ.
    // LƯU Ý HIỆU NĂNG: khác với InvoiceRepository.getInvoiceHistory() (lọc + phân trang ở DB),
    // hàm này load TOÀN BỘ invoice trong ngày rồi lọc/phân trang bằng Java Stream + subList().
    // Nếu số hóa đơn/ngày tăng nhiều, đây là chỗ cần tối ưu lại (chuyển filter xuống SQL).
    @Override
    @Transactional(readOnly = true)
    public PagedInvoiceResponse getTodayInvoices(String tableNumber, String keyword, String paymentMethod,
            String invoiceCode, int page, int size)
    {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1).minusNanos(1);

        List<Invoice> todayInvoices = invoiceRepository.findByInvoiceDateBetween(startOfDay, endOfDay);

        List<Invoice> filtered = todayInvoices.stream()
                .filter(inv -> tableNumber == null || tableNumber.isBlank()
                        || (inv.getOrder().getTable() != null
                                && inv.getOrder().getTable().getTableNumber().equalsIgnoreCase(tableNumber)))
                .filter(inv -> paymentMethod == null || paymentMethod.isBlank()
                        || (inv.getPayments() != null && !inv.getPayments().isEmpty()
                                && inv.getPayments().get(0).getPaymentMethod().name().equalsIgnoreCase(paymentMethod)))
                .filter(inv -> keyword == null || keyword.isBlank()
                        || (inv.getCustomer() != null
                                && (inv.getCustomer().getFullName().toLowerCase().contains(keyword.toLowerCase())
                                        || inv.getCustomer().getPhone().contains(keyword))))
                .filter(inv -> invoiceCode == null || invoiceCode.isBlank()
                        || String.valueOf(inv.getId()).contains(invoiceCode.replaceAll("[^0-9]", "")))
                .sorted(Comparator.comparing(Invoice::getInvoiceDate).reversed())
                .toList();

        int totalElements = filtered.size();
        int totalPages = (int) Math.ceil((double) totalElements / size);
        int fromIndex = Math.min(page * size, totalElements);
        int toIndex = Math.min(fromIndex + size, totalElements);
        List<Invoice> pageContent = filtered.subList(fromIndex, toIndex);

        List<CashierInvoiceSummaryResponse> content = pageContent.stream()
                .map(inv -> CashierInvoiceSummaryResponse.builder()
                        .invoiceId(inv.getId())
                        .tableNumber(inv.getOrder().getTable() != null
                                ? inv.getOrder().getTable().getTableNumber()
                                : "Mang về")
                        .invoiceDate(inv.getInvoiceDate())
                        .finalAmount(inv.getFinalAmount())
                        .customerName(inv.getCustomer() != null ? inv.getCustomer().getFullName() : null)
                        .paymentMethod(inv.getPayments() != null && !inv.getPayments().isEmpty()
                                ? inv.getPayments().get(0).getPaymentMethod().name()
                                : null)
                        .pointsUsed(inv.getPointsUsedOnInvoice())
                        .pointsEarned(inv.getPointsEarnedOnInvoice())
                        .build())
                .toList();

        return PagedInvoiceResponse.builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .build();
    }

    // Xem lại chi tiết 1 hóa đơn đã thanh toán (màn hình tra cứu/in lại) - chỉ tính món COMPLETED, khớp logic PDF
    @Override
    @Transactional(readOnly = true)
    public CashierInvoiceDetailResponse getInvoiceDetailForCashier(Long invoiceId)
    {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy hóa đơn"));

        Order order = invoice.getOrder();

        // Chỉ lấy món COMPLETED, khớp với logic PDF đã sửa trước đó
        List<OrderItem> completedItems = order.getOrderItems().stream()
                .filter(oi -> oi.getStatus() == OrderItemStatus.COMPLETED)
                .toList();

        BigDecimal totalBeforeVat = completedItems.stream()
                .map(OrderItem::getSubTotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal vatAmount = totalBeforeVat.multiply(new BigDecimal("0.10"));

        List<CashierInvoiceItemResponse> items = completedItems.stream()
                .map(oi -> CashierInvoiceItemResponse.builder()
                        .dishName(oi.getDishNameSnapshot())
                        .quantity(oi.getQuantity())
                        .unitPrice(oi.getUnitPrice())
                        .subTotal(oi.getSubTotal())
                        .build())
                .toList();

        Payment firstPayment = (invoice.getPayments() != null && !invoice.getPayments().isEmpty())
                ? invoice.getPayments().get(0)
                : null;

        BigDecimal amountPaid = (firstPayment != null && firstPayment.getAmount() != null)
                ? firstPayment.getAmount()
                : invoice.getFinalAmount();
        BigDecimal excessAmount = amountPaid.subtract(invoice.getFinalAmount());
        if (excessAmount.compareTo(BigDecimal.ZERO) < 0)
            excessAmount = BigDecimal.ZERO;

        return CashierInvoiceDetailResponse.builder()
                .invoiceId(invoice.getId())
                .tableNumber(order.getTable() != null ? order.getTable().getTableNumber() : "Mang về")
                .invoiceDate(invoice.getInvoiceDate())
                .items(items)
                .totalBeforeVat(totalBeforeVat)
                .vatAmount(vatAmount)
                .finalAmount(invoice.getFinalAmount())
                .paymentMethod(firstPayment != null ? firstPayment.getPaymentMethod().name() : null)
                .amountPaid(amountPaid)
                .excessAmount(excessAmount)
                .customerName(invoice.getCustomer() != null ? invoice.getCustomer().getFullName() : null)
                .pointsUsed(invoice.getPointsUsedOnInvoice())
                .pointsEarned(invoice.getPointsEarnedOnInvoice())
                .build();
    }

    // JOB TỰ ĐỘNG (1 giờ/lần): dọn rác các Order "toàn bộ món bị hủy" từ hôm qua trở về trước
    // (nhánh đặc biệt ở processPayment tạo ra các Order COMPLETED nhưng không có Invoice)
    @Scheduled(fixedRate = 3600000) // 1 giờ/lần — không cấp thiết như 2 job kia
    @Transactional
    public void cleanupStaleCancelledOrders()
    {
        LocalDateTime cutoff = LocalDate.now().atStartOfDay(); // đầu ngày hôm nay — xóa mọi Order "toàn hủy" từ hôm qua trở về trước

        List<Order> staleOrders = orderRepository
                .findByStatusAndInvoiceIsNullAndCreatedAtBefore(OrderStatus.COMPLETED, cutoff);

        if (!staleOrders.isEmpty())
        {
            orderRepository.deleteAll(staleOrders); // cascade xóa OrderItem con luôn (đã xác nhận cascade=ALL, orphanRemoval=true)
        }
    }

    // JOB TỰ ĐỘNG (5 phút/lần): tự phát hiện đơn LOCKED bị "kẹt" quá 15 phút (Cashier đóng tab/mất mạng giữa chừng)
    // và tự mở khóa về SERVING. LƯU Ý: không phân biệt đang chờ tiền mặt hay đang chờ VNPay redirect -> nếu khách
    // đang thao tác VNPay chậm quá 15 phút, đơn có thể bị auto-unlock trong lúc khách vẫn ở trang VNPay (edge case chấp nhận được).
    @Scheduled(fixedRate = 300000) // 5 phút/lần — đủ nhanh để không kẹt bàn lâu, không quá tải DB
    @Transactional
    public void autoUnlockStaleOrders()
    {
        LocalDateTime deadline = LocalDateTime.now().minusMinutes(15); // ngưỡng "kẹt": LOCKED quá 15 phút không ai xử lý tiếp

        List<Order> staleLockedOrders = orderRepository
                .findByStatusAndLockedAtBefore(OrderStatus.LOCKED, deadline);

        for (Order order : staleLockedOrders)
        {
            order.setStatus(OrderStatus.SERVING);
            order.setPendingCustomerId(null);
            order.setPendingPointsUsed(null);
            order.setLockedAt(null);
            orderRepository.save(order);
        }
    }

    // HÀM DÙNG CHUNG: công thức tính tiền chuẩn (chỉ cộng các món COMPLETED) - dùng ở nhiều nơi (completeCashPayment,
    // createVNPayPaymentUrl, processVnPaySuccess). Đổi công thức tính tiền thì sửa ở đây trước, nhưng nhớ kiểm tra
    // thêm các chỗ viết logic tương tự thủ công ở getOrderDetail/getInvoiceDetailForCashier.
    private BigDecimal calculateActualTotal(Order order)
    {
        if (order.getOrderItems() == null)
            return BigDecimal.ZERO;

        return order.getOrderItems().stream()
                .filter(oi -> oi.getStatus() == OrderItemStatus.COMPLETED)
                .map(oi -> oi.getSubTotal())
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // HÀM LÕI hệ thống điểm thưởng - dùng chung cho cả CASH và QRCODE:
    // 1) set customer vào invoice, 2) nếu dùng điểm: check đủ điểm -> check không vượt 50% hóa đơn -> trừ điểm -> trừ tiền,
    // 3) LUÔN cộng điểm mới = 1% giá trị hóa đơn SAU KHI đã trừ điểm dùng (làm tròn xuống theo mỗi 1.000đ).
    private BigDecimal applyLoyaltyPoints(Invoice invoice, Integer customerId, Integer pointsUsed,
            BigDecimal finalAmount)
    {
        if (customerId == null)
            return finalAmount;

        User customer = userRepository.findById(customerId).orElse(null);
        if (customer == null)
            return finalAmount;

        invoice.setCustomer(customer);
        int safePointsUsed = pointsUsed != null ? pointsUsed : 0;

        if (safePointsUsed > 0)
        {
            if (customer.getRewardPoints() < safePointsUsed)
            {
                throw new RuntimeException("Khách hàng không đủ điểm!");
            }
            BigDecimal discount = new BigDecimal(safePointsUsed).multiply(new BigDecimal("1000"));
            BigDecimal maxDiscount = finalAmount.multiply(new BigDecimal("0.5"));
            if (discount.compareTo(maxDiscount) > 0)
            {
                throw new RuntimeException("Số điểm sử dụng vượt quá 50% hóa đơn cho phép!");
            }
            customer.setRewardPoints(customer.getRewardPoints() - safePointsUsed);
            finalAmount = finalAmount.subtract(discount);
            if (finalAmount.compareTo(BigDecimal.ZERO) < 0)
                finalAmount = BigDecimal.ZERO;
            invoice.setPointsUsedOnInvoice(safePointsUsed);
        }

        int earnedPoints = finalAmount.multiply(new BigDecimal("0.01"))
                .divide(new BigDecimal("1000"), 0, RoundingMode.DOWN)
                .intValue();
        customer.setRewardPoints(customer.getRewardPoints() + earnedPoints);
        userRepository.save(customer);
        invoice.setPointsEarnedOnInvoice(earnedPoints);

        return finalAmount;
    }

    // Giải phóng bàn sau khi đóng đơn: chỉ giữ RESERVED nếu có reservation đang ở đúng trạng thái WAITING.
    // KHÔNG xét QUEUED ở đây (xem comment gốc bên dưới) - đây là bug đã từng gặp và được note lại cẩn thận.
    private void releaseTableAfterOrderClose(Order order)
    {
        if (order.getTable() == null)
            return;

        RestaurantTable table = order.getTable();
        // Chỉ giữ bàn (RESERVED) khi có reservation đang ở đúng khung giờ WAITING
        // (đúng theo định nghĩa TableStatus.RESERVED: "đồng bộ khi reservation tương ứng đang trong trạng thái WAITING").
        // KHÔNG xét QUEUED ở đây: một reservation QUEUED có thể còn cách rất xa giờ đặt (vài tiếng sau),
        // việc chuyển QUEUED -> WAITING (và set bàn RESERVED) đã được xử lý riêng bởi job
        // autoUpdateTableStatusToReserved() khi gần tới giờ đặt (trước 30 phút). Nếu đưa QUEUED vào đây,
        // bàn sẽ bị khóa RESERVED ngay sau khi thanh toán dù giờ đặt kế tiếp còn rất xa -> đây chính là bug.
        boolean hasWaitingReservation = reservationRepository
                .findFirstByTableIdAndStatus(table.getId(), ReservationStatus.WAITING)
                .isPresent();
        table.setStatus(hasWaitingReservation ? TableStatus.RESERVED : TableStatus.AVAILABLE);
        tableRepository.save(table);
        webSocketBroadcaster.broadcastAfterCommit("/topic/tables", "TABLE_UPDATED");
    }
}
