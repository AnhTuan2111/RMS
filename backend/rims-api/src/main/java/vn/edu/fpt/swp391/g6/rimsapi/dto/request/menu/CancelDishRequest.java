package vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CancelDishRequest
{
    @NotBlank(message = "Lý do hủy không được để trống")
    @Size(max = 100, message = "Lý do hủy không được vượt quá 100 ký tự")
    private String reason;
}
