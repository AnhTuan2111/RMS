package vn.edu.fpt.swp391.g6.rimsapi.dto.request.order;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CreateOrderRequest
{
    @NotNull(message = "Bàn không được để trống")
    @Positive(message = "ID bàn phải là số dương")
    private Integer tableId;

    @NotEmpty(message = "Đơn hàng phải có ít nhất một món")
    @Valid
    private List<OrderItemRequest> items;
}
