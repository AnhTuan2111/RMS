package vn.edu.fpt.swp391.g6.rimsapi.controller;

import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.payment.PaymentRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.OrderDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.payment.PaymentResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.payment.VNPayResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.CashierInvoiceDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.report.PagedInvoiceResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.table.TableDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.entity.User;
import vn.edu.fpt.swp391.g6.rimsapi.enums.PaymentMethod;
import vn.edu.fpt.swp391.g6.rimsapi.service.CashierService;
import vn.edu.fpt.swp391.g6.rimsapi.service.InvoicePdfService;

@RestController
@RequestMapping("/rims/cashier")
@RequiredArgsConstructor
public class CashierController
{

    private final CashierService cashierService;
    private final InvoicePdfService invoicePdfService;

    // API 1 xem danh sách 12 bàn
    @GetMapping("/tables")
    public ResponseEntity<List<TableDashboardResponse>> getTablesDashboard()
    {
        return ResponseEntity.ok(cashierService.getTablesDashboard());
    }

    // API 2 xem chi tiết từng bàn
    @GetMapping("/orders/{orderId}")
    public ResponseEntity<OrderDetailResponse> getOrderDetail(@PathVariable Long orderId)
    {
        return ResponseEntity.ok(cashierService.getOrderDetail(orderId));
    }
    //API 3 chọn method thanh toán
    @PostMapping("/orders/{id}/payment")
    public ResponseEntity<PaymentResponse> processPayment(
            @PathVariable Long id,
            @RequestBody PaymentRequest request)
    {
        return ResponseEntity.ok(cashierService.processPayment(id, request));
    }

    // API 4: Lấy danh sách phương thức thanh toán
    @GetMapping("/payment-methods")
    public ResponseEntity<List<String>> getPaymentMethods()
    {
        List<String> methods = java.util.Arrays.stream(PaymentMethod.values())
                .map(Enum::name)
                .toList();
        return ResponseEntity.ok(methods);
    }

    // API 5: Hoàn tất thanh toán Tiền mặt
    @PostMapping("/orders/{id}/complete-cash")
    public ResponseEntity<PaymentResponse> completeCashPayment(
            @PathVariable Long id,
            @RequestBody PaymentRequest request)
    {
        return ResponseEntity.ok(cashierService.completeCashPayment(id, request));
    }

    // API 6 sinh link Code VNPay dựa vào Order ID
    @GetMapping("/orders/{id}/vnpay-qr")
    public ResponseEntity<VNPayResponse> getVNPayQrCode(
            @PathVariable Long id,
            @RequestParam(required = false) Integer customerId,
            @RequestParam(required = false) Integer pointsUsed)
    {
        return ResponseEntity.ok(cashierService.createVNPayPaymentUrl(id, customerId, pointsUsed));
    }

    //API 7 xuất file PDF
    @GetMapping("/invoices/{invoiceId}/pdf")
    public ResponseEntity<byte[]> downloadInvoicePdf(@PathVariable Long invoiceId)
    {
        byte[] pdfBytes = invoicePdfService.generateInvoicePdf(invoiceId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("inline", "invoice-" + invoiceId + ".pdf");

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    // API 8: Đón kết quả Callback từ VNPay trả về
    @GetMapping("/payments/vnpay-callback")
    public void vnpayCallback(
            @RequestParam java.util.Map<String, String> vnpayParams,
            HttpServletResponse response) throws java.io.IOException
    {
        try
        {
            String vnp_ResponseCode = vnpayParams.get("vnp_ResponseCode");
            String vnp_TxnRef = vnpayParams.get("vnp_TxnRef");

            if ("00".equals(vnp_ResponseCode))
            {
                Long invoiceId = cashierService.processVnPaySuccess(vnp_TxnRef);
                String frontendSuccessUrl = "http://localhost:5173/payment-success?invoiceId=" + invoiceId;
                response.sendRedirect(frontendSuccessUrl);
            } else
            {
                cashierService.processVnPayFailed(vnp_TxnRef);
                response.sendRedirect("http://localhost:5173/payment-failed");
            }
        } catch (Exception e)
        {
            e.printStackTrace();
            // MỚI: luôn redirect về trang failed thay vì để trình duyệt treo trắng,
            // kể cả khi processVnPaySuccess/processVnPayFailed tự throw (VD: callback gọi lại lần 2)
            response.sendRedirect("http://localhost:5173/payment-failed");
        }
    }

    // API9 mở khóa đơn hàng khi bấm back hay bị thất bại
    @PostMapping("/orders/{id}/unlock")
    public ResponseEntity<PaymentResponse> unlockOrder(@PathVariable Long id)
    {
        return ResponseEntity.ok(cashierService.unlockOrder(id));
    }

    @GetMapping("/customers/search")
    public ResponseEntity<?> searchCustomer(@RequestParam String phone)
    {
        User customer = cashierService.searchCustomerByPhone(phone);
        if (customer == null)
            return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
                "id", customer.getId(),
                "fullName", customer.getFullName(),
                "phone", customer.getPhone(),
                "rewardPoints", customer.getRewardPoints()));
    }

    @PostMapping("/customers/create")
    public ResponseEntity<?> createCustomer(@RequestBody Map<String, String> body)
    {
        User newCustomer = cashierService.createCustomerFast(body.get("fullName"), body.get("phone"),
                body.get("email"));
        return ResponseEntity.ok(Map.of(
                "id", newCustomer.getId(),
                "fullName", newCustomer.getFullName(),
                "phone", newCustomer.getPhone(),
                "rewardPoints", newCustomer.getRewardPoints()));
    }

    @GetMapping("/invoices/today")
    public ResponseEntity<PagedInvoiceResponse> getTodayInvoices(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String tableNumber,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String invoiceCode)
    {
        return ResponseEntity
                .ok(cashierService.getTodayInvoices(tableNumber, keyword, paymentMethod, invoiceCode, page, size));
    }

    @GetMapping("/invoices/{invoiceId}")
    public ResponseEntity<CashierInvoiceDetailResponse> getInvoiceDetail(@PathVariable Long invoiceId)
    {
        return ResponseEntity.ok(cashierService.getInvoiceDetailForCashier(invoiceId));
    }
}
