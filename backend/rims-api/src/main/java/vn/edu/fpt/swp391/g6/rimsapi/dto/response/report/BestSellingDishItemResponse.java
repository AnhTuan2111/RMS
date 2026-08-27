package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BestSellingDishItemResponse
{

    private Integer rank;

    private String dishName;

    private String imageUrl;

    private Long totalQuantity;

    private BigDecimal totalRevenue;
}
