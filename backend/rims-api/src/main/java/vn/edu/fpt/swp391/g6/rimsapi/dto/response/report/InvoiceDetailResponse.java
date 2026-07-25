package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;


@Getter
@Setter
@Data
public class InvoiceDetailResponse
{

    private Long invoiceId;

    private Long orderId;

    private String tableNumber;

    private String paymentMethod;

    private BigDecimal totalBeforeVat;

    private BigDecimal vatAmount;

    private BigDecimal finalAmount;

    private BigDecimal amountPaid;

    private BigDecimal excessAmount;

    private LocalDateTime invoiceDate;

    private List<InvoiceItemResponse> items;
}