package vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu;

import lombok.*;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MenuItemResponse
{
    private Integer dishId;
    private String name;
    private String description;
    private int price;
    private String imageUrl;
    private String categoryName;
    private boolean available;
}
