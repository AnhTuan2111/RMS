package vn.edu.fpt.swp391.g6.rimsapi.dto.response.order;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CancelledOrderResponse
{

    private Long orderItemId;

    private Long orderId;

    private String tableNumber;

    private String dishName;

    private Integer quantity;

    private String cancelReason;

    private LocalDateTime cancelledAt;
}
