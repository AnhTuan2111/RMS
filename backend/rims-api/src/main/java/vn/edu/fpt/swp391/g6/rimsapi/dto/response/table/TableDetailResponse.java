package vn.edu.fpt.swp391.g6.rimsapi.dto.response.table;

import java.time.LocalDateTime;

import lombok.*;

import vn.edu.fpt.swp391.g6.rimsapi.enums.TableStatus;

@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TableDetailResponse
{
    private Integer tableId;
    private String tableNumber;
    private Integer capacity;
    private TableStatus status;
    private LocalDateTime upcomingReservationTime;
    private String upcomingCustomerName;
}
