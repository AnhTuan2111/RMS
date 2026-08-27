package vn.edu.fpt.swp391.g6.rimsapi.dto.response.payment;

import java.math.BigDecimal;

import lombok.*;

@Getter
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class PaymentResponse
{
    private String message;
    private boolean success;
    private Long invoiceId;
    private BigDecimal amountPaid;
    private BigDecimal excessAmount;

    private BigDecimal finalAmount; // Số tiền thực phải trả SAU KHI đã trừ điểm
    private String customerName; // Tên khách hàng (null nếu không gắn tài khoản)
    private Integer pointsUsed; // Số điểm đã dùng để giảm giá
    private Integer pointsEarned; // Số điểm tích lũy thêm được
    private String paymentMethod; // "CASH" hoặc "QRCODE"
    private boolean autoClosedNoPayment; // true khi đơn tự đóng do toàn bộ món đã bị hủy, không có gì để thanh toán
}
