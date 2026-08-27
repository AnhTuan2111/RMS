package vn.edu.fpt.swp391.g6.rimsapi.dto.response.kitchen;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChefDashboardResponse
{

    // Số món đang chuẩn bị
    private long preparingCount;

    // Số món đã hoàn thành
    private long completedCount;
    private long cancelledCount;

    // Số món đang tạm hết
    private long unavailableDishCount;
}
