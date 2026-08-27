package vn.edu.fpt.swp391.g6.rimsapi.dto.response.order;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UpdateOrderResponse
{
    private Long orderId;
    private String tableNumber;
    private String message;
    private BigDecimal totalAmount;
}
