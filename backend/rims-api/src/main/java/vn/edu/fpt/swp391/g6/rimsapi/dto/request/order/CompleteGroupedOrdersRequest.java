package vn.edu.fpt.swp391.g6.rimsapi.dto.request.order;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CompleteGroupedOrdersRequest
{
    @NotEmpty(message = "Danh sách món không được để trống")
    private List<@NotNull(message = "ID món không được để trống") Long> orderItemIds;
}
