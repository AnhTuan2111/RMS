package vn.edu.fpt.swp391.g6.rimsapi.dto.request.reservation;

import java.time.LocalDateTime;

import jakarta.validation.constraints.*;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class CreateReservationRequest
{
    @NotBlank(message = "Tên khách hàng không được để trống")
    @Size(max = 50, message = "Tên khách hàng không được vượt quá 50 ký tự")
    @Pattern(regexp = "^\\p{L}+( \\p{L}+)*$", message = "Tên chỉ được chứa chữ cái và khoảng trắng")
    private String customerName;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^0[0-9]{9}$", message = "Số điện thoại phải có 10 số và bắt đầu bằng 0")
    private String phone;

    @Size(max = 255, message = "Ghi chú không được vượt quá 255 ký tự")
    private String note;

    @NotNull(message = "Bàn không được để trống")
    @Min(value = 1, message = "ID bàn phải lớn hơn 0")
    @Max(value = 12, message = "ID bàn không hợp lệ")
    private Integer tableId;

    @NotNull(message = "Thời gian đặt bàn không được để trống")
    private LocalDateTime reservationTime;
}
