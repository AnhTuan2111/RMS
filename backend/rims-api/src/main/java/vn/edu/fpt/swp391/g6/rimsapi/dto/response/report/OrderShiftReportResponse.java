package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderShiftReportResponse
{

    private LocalDate startDate;

    private LocalDate endDate;

    private Long totalPaidOrders;

    private BigDecimal averageOrdersPerDay;

    private HighestOrderShiftResponse highestOrderShift;

    private List<OrderShiftItemResponse> shifts;
}
