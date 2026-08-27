package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CashierInvoiceDetailResponse
{
    private Long invoiceId;
    private String tableNumber;
    private LocalDateTime invoiceDate;
    private List<CashierInvoiceItemResponse> items;
    private BigDecimal totalBeforeVat;
    private BigDecimal vatAmount;
    private BigDecimal finalAmount;
    private String paymentMethod;
    private BigDecimal amountPaid;
    private BigDecimal excessAmount;
    private String customerName;
    private Integer pointsUsed;
    private Integer pointsEarned;
}
