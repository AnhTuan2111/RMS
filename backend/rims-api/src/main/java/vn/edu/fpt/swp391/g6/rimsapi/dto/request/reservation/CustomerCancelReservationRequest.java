package vn.edu.fpt.swp391.g6.rimsapi.dto.request.reservation;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

@Data
public class CustomerCancelReservationRequest
{
    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^0[0-9]{9}$", message = "Số điện thoại phải có 10 số và bắt đầu bằng 0")
    private String phone;

    @NotNull(message = "Ngày đặt bàn không được để trống")
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate reservationDate;
}
