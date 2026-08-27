package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;

import lombok.Data;

@Data
public class InvoiceItemResponse
{

    private String dishName;

    private Integer quantity;

    private BigDecimal unitPrice;

    private BigDecimal amount;
}
