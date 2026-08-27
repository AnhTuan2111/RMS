package vn.edu.fpt.swp391.g6.rimsapi.dto.response.table;

import lombok.*;

import vn.edu.fpt.swp391.g6.rimsapi.enums.TableStatus;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TableDashboardResponse
{
    private Integer tableId;
    private String tableNumber;
    private TableStatus status; // xem ban nao có order hay không
    private Long orderId; // hiển thị cái order id của bàn nào đang có phục vụ
}
