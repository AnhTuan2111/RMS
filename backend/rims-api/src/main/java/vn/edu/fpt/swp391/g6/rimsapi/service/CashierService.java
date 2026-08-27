package vn.edu.fpt.swp391.g6.rimsapi.service;

import java.util.List;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.payment.PaymentRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.OrderDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.payment.PaymentResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.payment.VNPayResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.CashierInvoiceDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.PagedInvoiceResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.table.TableDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.entity.User;

public interface CashierService
{
    // Lấy danh sách bàn kèm trạng thái (AVAILABLE/SERVING) cho dashboard Cashier
    List<TableDashboardResponse> getTablesDashboard();

    // Xem chi tiết đơn hàng (chỉ tính các món COMPLETED) trước khi thanh toán, không đổi trạng thái gì
    OrderDetailResponse getOrderDetail(Long orderId);

    // Bước 1: "chốt" đơn trước khi thanh toán thật - chặn nếu còn món đang làm, tự đóng đơn nếu toàn bộ món đã hủy
    PaymentResponse processPayment(Long orderId, PaymentRequest request);

    // Callback khi VNPay báo THẤT BẠI/hủy - mở khóa đơn về SERVING, không tạo Invoice, không đụng điểm khách
    void processVnPayFailed(String vnpTxnRef);

    // Cashier bấm "Hủy" giữa chừng thanh toán - trả đơn từ LOCKED về SERVING
    PaymentResponse unlockOrder(Long orderId);

    // Bước 2 (nhánh tiền mặt): thực sự tạo Invoice + Payment, trừ/cộng điểm, đóng đơn, giải phóng bàn
    PaymentResponse completeCashPayment(Long orderId, PaymentRequest request);

    // Bước 2 (nhánh VNPay - phần 1): tính tiền, trừ tạm điểm để ra số tiền gửi qua VNPay, sinh URL redirect
    VNPayResponse createVNPayPaymentUrl(Long orderId, Integer customerId, Integer pointsUsed);

    // Bước 2 (nhánh VNPay - phần 2): callback khi VNPay báo THÀNH CÔNG - tạo Invoice thật, áp dụng điểm thật
    Long processVnPaySuccess(String vnpTxnRef);

    // Tra cứu khách hàng theo SĐT (chỉ trả về nếu role = CUSTOMER)
    User searchCustomerByPhone(String phone);

    // Tạo nhanh tài khoản khách vãng lai (username = phone, mật khẩu mặc định)
    User createCustomerFast(String fullName, String phone, String email);

    // Danh sách hóa đơn trong ngày hôm nay, có filter theo bàn/từ khóa/phương thức/mã HĐ + phân trang thủ công
    PagedInvoiceResponse getTodayInvoices(String tableNumber, String keyword, String paymentMethod, String invoiceCode,
            int page, int size);

    // Xem lại chi tiết 1 hóa đơn đã thanh toán (dùng cho màn hình tra cứu/in lại)
    CashierInvoiceDetailResponse getInvoiceDetailForCashier(Long invoiceId);
}
