// src/main/java/vn/edu/fpt/swp391/g6/rimsapi/service/CustomerReservationService.java

package vn.edu.fpt.swp391.g6.rimsapi.service;

import java.time.LocalDate;
import java.util.List;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.reservation.CustomerCreateReservationRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.CustomerReservationResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.RestaurantTableResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.TimeRangeResponse;

public interface CustomerService
{

    /**
     * Customer đặt bàn - 1 user chỉ đặt 1 bàn
     */
    CustomerReservationResponse createReservation(CustomerCreateReservationRequest request);

    /**
     * Customer hủy đặt bàn - nhận cả userId (check ownership) và reservationId (đặt bàn cụ thể cần hủy)
     * Không còn tự lấy "đặt bàn gần nhất" nữa vì có thể hủy nhầm nếu user có nhiều active reservation
     */
    CustomerReservationResponse cancelReservation(Integer userId, Long reservationId);

    /**
     * Kiểm tra customer đã đặt bàn trong ngày chưa
     */
    boolean checkCustomerReservationByUser(Integer userId, String date);

    /**
     * Lấy đặt bàn hiện tại của customer
     */
    List<CustomerReservationResponse> getCurrentReservationByUser(Integer userId);

    /**
     * Lấy danh sách bàn còn trống để customer chọn khi đặt bàn
     */
    List<RestaurantTableResponse> getAvailableTables();

    /**
     * Lấy danh sách khung giờ bị chặn (không thể đặt) của 1 bàn trong 1 ngày,
     * gộp từ: các reservation đang active (QUEUED/WAITING) tại bàn đó,
     * và đơn đang SERVING (nếu bàn đang phục vụ).
     */
    List<TimeRangeResponse> getBlockedTimeRanges(int tableId, LocalDate date);

}
