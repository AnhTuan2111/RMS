package vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu;

import jakarta.validation.constraints.NotNull;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateMenuStatusRequest
{
    @NotNull(message = "Trạng thái hiển thị không được để trống")
    private Boolean available;
}
