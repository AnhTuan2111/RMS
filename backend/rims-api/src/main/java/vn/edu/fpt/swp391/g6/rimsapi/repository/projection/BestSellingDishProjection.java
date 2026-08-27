package vn.edu.fpt.swp391.g6.rimsapi.repository.projection;

import java.math.BigDecimal;

public interface BestSellingDishProjection
{

    String getDishName();

    String getImageUrl();

    Long getTotalQuantity();

    BigDecimal getTotalRevenue();
}
