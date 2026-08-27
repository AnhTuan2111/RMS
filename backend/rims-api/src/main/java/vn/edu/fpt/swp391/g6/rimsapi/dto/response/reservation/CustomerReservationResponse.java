package vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Data;

import vn.edu.fpt.swp391.g6.rimsapi.enums.ReservationStatus;

@Data
@Builder
public class CustomerReservationResponse
{
    private Long id;
    private String customerName;
    private String phone;
    private LocalDateTime reservationTime;
    private String note;
    private ReservationStatus status;
    private String tableNumber;
    private Integer capacity;
    private String tableStatus;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
