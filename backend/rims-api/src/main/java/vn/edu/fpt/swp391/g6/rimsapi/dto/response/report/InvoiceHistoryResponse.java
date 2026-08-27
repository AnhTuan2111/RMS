package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import vn.edu.fpt.swp391.g6.rimsapi.enums.PaymentMethod;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InvoiceHistoryResponse
{

    private Long invoiceId;

    private Long orderId;

    private String tableNumber;

    private PaymentMethod paymentMethod;

    private BigDecimal amount;

    private LocalDateTime paymentDate;
}
