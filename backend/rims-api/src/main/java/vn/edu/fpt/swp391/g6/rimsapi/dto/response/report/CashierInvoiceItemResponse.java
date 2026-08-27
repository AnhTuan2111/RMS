package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CashierInvoiceItemResponse
{
    private String dishName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal subTotal;
}
