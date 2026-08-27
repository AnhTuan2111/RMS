package vn.edu.fpt.swp391.g6.rimsapi.repository.projection;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface DailyRevenueProjection
{

    LocalDate getRevenueDate();

    BigDecimal getRevenue();
}
