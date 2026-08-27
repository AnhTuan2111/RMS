package vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class UpdateCategoryRequest
{
    @NotBlank(message = "Tên danh mục không được để trống")
    @Size(max = 50, message = "Tên danh mục không được vượt quá 50 ký tự")
    private String name;

    @Size(max = 100, message = "Mô tả không được vượt quá 100 ký tự")
    private String description;

    @NotNull(message = "Trạng thái hiển thị không được để trống")
    private Boolean isAvailable;
}
