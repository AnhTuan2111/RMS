package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CashierInvoiceSummaryResponse
{
    private Long invoiceId;
    private String tableNumber;
    private LocalDateTime invoiceDate;
    private BigDecimal finalAmount;
    private String customerName;
    private String paymentMethod;
    private Integer pointsUsed;
    private Integer pointsEarned;
}
