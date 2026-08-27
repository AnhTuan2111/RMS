package vn.edu.fpt.swp391.g6.rimsapi.dto.response.order;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GroupedKitchenItemResponse
{

    private Long orderItemId;

    private Long orderId;

    private String tableNumber;

    private Integer quantity;

    private LocalDateTime createdAt;
}
