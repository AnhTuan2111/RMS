package vn.edu.fpt.swp391.g6.rimsapi.dto.request.order;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UpdateOrderRequest
{
    @NotEmpty(message = "Đơn hàng phải có ít nhất một món")
    @Valid
    private List<UpdateOrderItemRequest> items;
}
