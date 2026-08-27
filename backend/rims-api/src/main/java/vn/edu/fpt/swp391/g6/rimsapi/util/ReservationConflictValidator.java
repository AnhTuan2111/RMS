package vn.edu.fpt.swp391.g6.rimsapi.util;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Component;

import vn.edu.fpt.swp391.g6.rimsapi.entity.Reservation;
import vn.edu.fpt.swp391.g6.rimsapi.enums.ReservationStatus;

@Component
public class ReservationConflictValidator
{

    public static final int TABLE_TURNAROUND_MINUTES = 150;

    /**
     * Kiểm tra conflict khi đặt bàn, bao gồm cả 2 trường hợp:
     * <ol>
     *   <li>Trùng với reservation khác trong khoảng {@value TABLE_TURNAROUND_MINUTES} phút.</li>
     *   <li>Bàn đang SERVING: thời gian đặt ({@code requestedTime}) cách thời điểm
     *       tạo order đang phục vụ ({@code servingOrderCreatedAt}) ít hơn
     *       {@value TABLE_TURNAROUND_MINUTES} phút — tức là bàn chưa kịp xoay vòng.</li>
     * </ol>
     *
     * @param existingReservations  danh sách reservation hiện tại của bàn trong khoảng thời gian liên quan
     * @param requestedTime         thời gian đặt bàn được yêu cầu
     * @param excludeReservationId  ID reservation cần bỏ qua khi kiểm tra (dùng cho update), {@code null} nếu không cần
     * @param servingOrderCreatedAt thời điểm tạo order đang phục vụ bàn (chỉ truyền khi bàn ở trạng thái SERVING),
     *                              {@code null} nếu bàn không đang SERVING
     * @return {@code true} nếu xảy ra conflict, {@code false} nếu không
     */
    public boolean hasConflict(List<Reservation> existingReservations,
            LocalDateTime requestedTime,
            Long excludeReservationId,
            LocalDateTime servingOrderCreatedAt)
    {
        // Kiểm tra conflict với order đang serving (nếu bàn đang ở trạng thái SERVING)
        if (servingOrderCreatedAt != null)
        {
            long minutesBetween = Duration.between(servingOrderCreatedAt, requestedTime).toMinutes();
            if (minutesBetween < TABLE_TURNAROUND_MINUTES)
            {
                return true;
            }
        }

        // Kiểm tra conflict với các reservation khác trong cửa sổ thời gian
        LocalDateTime start = requestedTime.minusMinutes(TABLE_TURNAROUND_MINUTES);
        LocalDateTime end = requestedTime.plusMinutes(TABLE_TURNAROUND_MINUTES);

        for (Reservation res : existingReservations)
        {
            if (res.getStatus() != ReservationStatus.CANCELLED)
            {
                if (excludeReservationId != null && excludeReservationId.equals(res.getId()))
                {
                    continue;
                }
                if (res.getReservationTime().isAfter(start) && res.getReservationTime().isBefore(end))
                {
                    return true;
                }
            }
        }
        return false;
    }
}
