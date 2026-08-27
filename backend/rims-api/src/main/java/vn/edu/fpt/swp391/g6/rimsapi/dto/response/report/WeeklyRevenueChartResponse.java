package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.time.LocalDate;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WeeklyRevenueChartResponse
{

    private LocalDate fromDate;

    private LocalDate toDate;

    private List<DailyRevenueItemResponse> items;
}
