package vn.edu.fpt.swp391.g6.rimsapi.repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import vn.edu.fpt.swp391.g6.rimsapi.entity.Reservation;
import vn.edu.fpt.swp391.g6.rimsapi.enums.ReservationStatus;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long>
{
    List<Reservation> findByTableIdAndReservationTimeBetweenAndStatusIn(
            int tableId,
            LocalDateTime start,
            LocalDateTime end,
            List<ReservationStatus> statuses);

    List<Reservation> findByTableIdAndReservationTimeBetween(
            int tableId,
            LocalDateTime start,
            LocalDateTime end);

    Optional<Reservation> findFirstByTableIdAndStatus(int tableId, ReservationStatus status);

    // Lấy các reservation QUEUED sắp tới trong vòng 30 phút (để chuyển sang WAITING)
    // WHERE status = QUEUED AND reservation_time BETWEEN :from AND :to
    List<Reservation> findByStatusAndReservationTimeBetween(
            ReservationStatus status,
            LocalDateTime from,
            LocalDateTime to);

    // Lấy các reservation WAITING đã quá hạn (để tự hủy)
    // WHERE status = WAITING AND reservation_time < :deadline
    List<Reservation> findByStatusAndReservationTimeBefore(
            ReservationStatus status,
            LocalDateTime deadline);

    // Lấy các reservation còn "sống" (chưa CANCELLED/COMPLETED) của 1 bàn để service tự tính overlap
    // Tính existingEnd = reservationTime + duration + buffer ở tầng Java để không phụ thuộc cú pháp
    // DATE_ADD/DATEADD riêng của từng loại DB (MySQL vs SQL Server khác nhau)
    @Query("SELECT r FROM Reservation r WHERE r.table.id = :tableId AND r.status NOT IN ('CANCELLED', 'COMPLETED')")
    List<Reservation> findActiveReservationsByTableId(@Param("tableId") Integer tableId);

    // Tìm reservation hiện tại của user (chưa COMPLETED hoặc CANCELLED)
    @Query("SELECT r FROM Reservation r WHERE r.user.id = :userId AND r.status NOT IN ('COMPLETED', 'CANCELLED') ORDER BY r.reservationTime ASC")
    List<Reservation> findCurrentReservationsByUser(@Param("userId") Integer userId);

    // Kiểm tra user đã đặt bàn trong ngày và chưa COMPLETED/CANCELLED
    @Query("SELECT COUNT(r) > 0 FROM Reservation r WHERE r.user.id = :userId AND CAST(r.reservationTime AS date) = :date AND r.status NOT IN ('COMPLETED', 'CANCELLED')")
    boolean existsActiveReservationByUserIdAndDate(@Param("userId") Integer userId, @Param("date") LocalDate date);

    // Dùng cho Waiter đặt hộ khách (walk-in, không có tài khoản) — chặn 1 SĐT chỉ được
    // có 1 đặt bàn đang hoạt động trong cùng 1 ngày. Trả về List thay vì boolean để
    // service có thể loại trừ chính reservation đang sửa (update flow).
    @Query("SELECT r FROM Reservation r WHERE r.phone = :phone AND CAST(r.reservationTime AS date) = :date AND r.status NOT IN ('COMPLETED', 'CANCELLED')")
    List<Reservation> findActiveReservationsByPhoneAndDate(@Param("phone") String phone, @Param("date") LocalDate date);

}
