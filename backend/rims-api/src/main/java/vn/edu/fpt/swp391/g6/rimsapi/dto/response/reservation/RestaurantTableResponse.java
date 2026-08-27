package vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RestaurantTableResponse
{
    private Integer id;
    private String tableNumber;
    private Integer capacity;
    private String status;
}
