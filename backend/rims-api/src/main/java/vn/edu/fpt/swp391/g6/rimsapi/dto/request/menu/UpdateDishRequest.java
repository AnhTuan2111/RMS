package vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import lombok.Data;

@Data
public class UpdateDishRequest
{
    @NotBlank(message = "Tên món ăn không được để trống")
    @Size(max = 50, message = "Tên món ăn không được vượt quá 50 ký tự")
    private String name;

    @Size(max = 100, message = "Mô tả không được vượt quá 100 ký tự")
    private String description;

    @NotNull(message = "Giá món ăn không được để trống")
    @Positive(message = "Giá món ăn phải lớn hơn 0")
    private Integer price;

    @Size(max = 500, message = "Đường dẫn hình ảnh không được vượt quá 500 ký tự")
    private String imageUrl;

    @NotNull(message = "Trạng thái sẵn sàng không được để trống")
    private Boolean isAvailable;

    private Boolean isHidden;

    @NotNull(message = "Danh mục không được để trống")
    private Integer categoryId;
}
