package vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu;

import java.time.LocalDateTime;

import lombok.Data;

@Data
public class DishResponse
{
    private Integer id;
    private String name;
    private String description;
    private Integer price;
    private Boolean isAvailable;
    private Boolean isHidden;
    private String imageUrl;
    private String categoryName;
    private Integer categoryId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
