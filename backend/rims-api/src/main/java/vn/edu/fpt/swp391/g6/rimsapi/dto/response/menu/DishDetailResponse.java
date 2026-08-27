package vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu;

import java.time.LocalDateTime;

import lombok.Getter;
import lombok.Setter;

import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderItemStatus;

@Getter
@Setter
public class DishDetailResponse
{
    private Long orderItemId;

    // Bàn gọi món
    private String tableNumber;

    // Tên món
    private String dishName;

    // Mô tả món
    private String description;

    // Số lượng
    private Integer quantity;

    // Ghi chú của khách
    private String note;

    // Trạng thái món
    private OrderItemStatus status;
    private LocalDateTime createdAt;
    private String chefInternalNote;

    private LocalDateTime chefInternalNoteCreatedAt;

    private LocalDateTime chefInternalNoteAcknowledgedAt;
}
