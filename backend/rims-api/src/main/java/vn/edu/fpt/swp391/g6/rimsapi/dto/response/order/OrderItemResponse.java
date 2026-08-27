package vn.edu.fpt.swp391.g6.rimsapi.dto.response.order;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.*;

import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderItemStatus;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrderItemResponse
{
    private Long orderItemId;
    private Integer dishId;
    private String dishName;
    private OrderItemStatus status;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal subTotal;
    private String note;
    private String cancelReason;
    private String chefInternalNote;
    private LocalDateTime chefInternalNoteCreatedAt;
    private LocalDateTime chefInternalNoteAcknowledgedAt;
}
