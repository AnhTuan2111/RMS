package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;
import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailyRevenueItemResponse
{

    private String dayLabel;

    private LocalDate date;

    private BigDecimal revenue;
}
