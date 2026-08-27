package vn.edu.fpt.swp391.g6.rimsapi.dto.response.kitchen;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderItemStatus;

@Getter
@Setter
public class KitchenOrderResponse
{

    private Long orderItemId;

    private Long orderId;

    private String tableNumber;

    private String dishName;

    private Integer quantity;

    private OrderItemStatus status;
    private LocalDateTime createdAt;
}
