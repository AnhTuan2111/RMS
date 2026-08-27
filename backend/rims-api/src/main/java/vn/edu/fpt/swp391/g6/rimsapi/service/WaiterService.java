package vn.edu.fpt.swp391.g6.rimsapi.service;

import java.time.LocalDate;
import java.util.List;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.order.CreateOrderRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.order.UpdateOrderRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.reservation.CreateReservationRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.MenuItemResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.CreateOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.OrderDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.UpdateOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.ReservationDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.TimeRangeResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.table.TableDetailResponse;

public interface WaiterService
{
    List<TimeRangeResponse> getBlockedTimeRanges(int tableId, LocalDate date, Long excludeReservationId);

    List<TableDetailResponse> getAllTables();

    CreateOrderResponse createOrder(CreateOrderRequest request, Integer waiterId);

    CreateOrderResponse createOrderFromReservation(Long reservationId, CreateOrderRequest request, Integer waiterId);

    UpdateOrderResponse updateOrder(Long orderId, UpdateOrderRequest request, Integer waiterId);

    List<MenuItemResponse> getMenu();

    // view order detail
    List<OrderDetailResponse> getServingOrders(int tableId);

    // tạo đơn đặt hàng
    String createReservation(CreateReservationRequest request);

    // để waiter xem các đơn đặt tương ứng vói số bàn và ngày
    List<ReservationDetailResponse> viewReservationsByTableAndTime(int tableId, LocalDate date);

    // view reservation detail ứng với số bàn (chỉ queued và waiting status)
    ReservationDetailResponse getCurrentReservationByTable(int tableId);

    // sử dụng để tự điền thông tin vào form Khi update reservation
    ReservationDetailResponse viewReservationDetail(Long reservationId);

    // update reservation
    String updateReservation(Long reservationId, CreateReservationRequest request);

    // cancel reservation
    String cancelReservation(Long reservationId);
    void acknowledgeChefInternalNote(Long orderItemId);
}
