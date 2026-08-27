package vn.edu.fpt.swp391.g6.rimsapi.dto.request.payment;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import lombok.Getter;
import lombok.Setter;

import vn.edu.fpt.swp391.g6.rimsapi.enums.PaymentMethod;

@Getter
@Setter
public class PaymentRequest
{
    @NotNull(message = "Phương thức thanh toán không được để trống")
    private PaymentMethod paymentMethod;

    @NotNull(message = "Số tiền thanh toán không được để trống")
    @PositiveOrZero(message = "Số tiền thanh toán phải lớn hơn hoặc bằng 0")
    private Double amountPaid;

    private Integer customerId;

    @PositiveOrZero(message = "Điểm sử dụng phải lớn hơn hoặc bằng 0")
    private Integer pointsUsed = 0;
}
