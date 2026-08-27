package vn.edu.fpt.swp391.g6.rimsapi.dto.response.report;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderShiftItemResponse
{

    private String shiftName;

    private String displayName;

    private String startTime;

    private String endTime;

    private Long orderCount;

    private BigDecimal percentage;
}
