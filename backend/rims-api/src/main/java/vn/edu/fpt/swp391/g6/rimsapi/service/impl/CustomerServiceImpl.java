package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.reservation.CustomerCreateReservationRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.CustomerReservationResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.RestaurantTableResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.TimeRangeResponse;
import vn.edu.fpt.swp391.g6.rimsapi.enums.TableStatus;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Order;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Reservation;
import vn.edu.fpt.swp391.g6.rimsapi.entity.RestaurantTable;
import vn.edu.fpt.swp391.g6.rimsapi.entity.User;
import vn.edu.fpt.swp391.g6.rimsapi.enums.ReservationStatus;
import vn.edu.fpt.swp391.g6.rimsapi.exception.GlobalExceptionHandler;
import vn.edu.fpt.swp391.g6.rimsapi.exception.GlobalExceptionHandler.ResourceNotFoundException;
import vn.edu.fpt.swp391.g6.rimsapi.repository.OrderRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.ReservationRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.RestaurantTableRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.UserRepository;
import vn.edu.fpt.swp391.g6.rimsapi.service.CustomerService;
import vn.edu.fpt.swp391.g6.rimsapi.util.ReservationConflictValidator;
import vn.edu.fpt.swp391.g6.rimsapi.util.WebSocketBroadcaster;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomerServiceImpl implements CustomerService
{

    private final ReservationRepository reservationRepository;
    private final RestaurantTableRepository tableRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final ReservationConflictValidator conflictValidator;
    private final WebSocketBroadcaster webSocketBroadcaster;

    @Override
    @Transactional
    public CustomerReservationResponse createReservation(CustomerCreateReservationRequest request) {

        User user = userRepository.findByIdForUpdate(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy người dùng với ID: " + request.getUserId()));

        if (request.getReservationTime().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Thời gian đặt bàn phải ở trong tương lai.");
        }
        LocalTime time = request.getReservationTime().toLocalTime();
        LocalTime openTime = LocalTime.of(8, 0);
        LocalTime closeTime = LocalTime.of(20, 0);

        if (time.isBefore(openTime) || time.isAfter(closeTime)) {
            throw new GlobalExceptionHandler.BusinessException("Nhà hàng chỉ nhận đặt bàn trong khoảng 08:00 - 20:00");
        }

        // Chặn 1 khách có nhiều hơn 1 đặt bàn đang hoạt động trong cùng 1 ngày
        LocalDate reservationDate = request.getReservationTime().toLocalDate();
        if (reservationRepository.existsActiveReservationByUserIdAndDate(user.getId(), reservationDate)) {
            throw new IllegalArgumentException(
                    "Bạn đã có một đặt bàn đang hoạt động trong ngày này, vui lòng hủy đặt bàn cũ trước khi đặt bàn mới.");
        }

        // Chặn thêm theo số điện thoại: phòng trường hợp 1 khách dùng nhiều tài khoản
        // khác nhau nhưng cùng 1 SĐT để đặt trùng ngày (bypass check theo userId ở trên).
        if (!reservationRepository
                .findActiveReservationsByPhoneAndDate(request.getPhone(), reservationDate)
                .isEmpty()) {
            throw new IllegalArgumentException(
                    "Số điện thoại này đã có một đặt bàn đang hoạt động trong ngày này, vui lòng hủy đặt bàn cũ trước khi đặt bàn mới.");
        }

        RestaurantTable table = tableRepository.findByIdForUpdate(request.getTableId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bàn với ID: " + request.getTableId()));

        LocalDateTime start = request.getReservationTime().minusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);
        LocalDateTime end = request.getReservationTime().plusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);

        List<Reservation> existingReservations = reservationRepository
                .findByTableIdAndReservationTimeBetweenAndStatusIn(request.getTableId(), start, end, List.of(ReservationStatus.QUEUED, ReservationStatus.WAITING));

        LocalDateTime servingOrderCreatedAt = null;
        if (table.getStatus() == TableStatus.SERVING)
        {
            servingOrderCreatedAt = orderRepository.findServingOrdersWithDetails(table.getId())
                    .stream().findFirst()
                    .map(Order::getCreatedAt)
                    .orElse(null);
        }

        if (conflictValidator.hasConflict(existingReservations, request.getReservationTime(), null, servingOrderCreatedAt)) {
            throw new IllegalArgumentException(
                    "Bàn đã được đặt trong khoảng thời gian này, các đơn phải cách nhau ít nhất 2.5 tiếng.");
        }

        Reservation reservation = new Reservation();
        reservation.setCustomerName(request.getCustomerName());
        reservation.setPhone(request.getPhone());
        reservation.setNote(request.getNote());
        reservation.setReservationTime(request.getReservationTime());
        reservation.setTable(table);
        reservation.setStatus(ReservationStatus.QUEUED);
        reservation.setUser(user);

        reservationRepository.save(reservation);
        webSocketBroadcaster.broadcastAfterCommit("/topic/tables", "TABLE_UPDATED");
        return convertToCustomerResponse(reservation);
    }

    @Override
    @Transactional
    public CustomerReservationResponse cancelReservation(Integer userId, Long reservationId) {

        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId);
        }

        List<Reservation> currentReservations = reservationRepository.findCurrentReservationsByUser(userId);

        if (currentReservations.isEmpty()) {
            throw new ResourceNotFoundException("Bạn không có đặt bàn nào đang hoạt động để hủy.");
        }

        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt bàn với ID: " + reservationId));

        if (reservation.getUser() == null || !reservation.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("Bạn không có quyền hủy đặt bàn này");
        }

        if (reservation.getStatus() == ReservationStatus.CANCELLED
                || reservation.getStatus() == ReservationStatus.COMPLETED) {
            throw new IllegalArgumentException("Đặt bàn này đã "
                    + (reservation.getStatus() == ReservationStatus.COMPLETED ? "hoàn tất" : "bị hủy")
                    + " trước đó, không thể hủy lại.");
        }

        boolean tableReleased = false;
        if (reservation.getStatus() == ReservationStatus.WAITING) {
            RestaurantTable currentTable = tableRepository.findByIdForUpdate(reservation.getTable().getId()).orElse(null);
            if (currentTable != null && currentTable.getStatus() == TableStatus.RESERVED) {
                currentTable.setStatus(TableStatus.AVAILABLE);
                tableRepository.save(currentTable);
                tableReleased = true;
            }
        }

        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        if (tableReleased) {
            webSocketBroadcaster.broadcastAfterCommit("/topic/tables", "TABLE_UPDATED");
        }

        return convertToCustomerResponse(reservation);
    }

    @Override
    public boolean checkCustomerReservationByUser(Integer userId, String date) {
        try {

            LocalDate reservationDate = LocalDate.parse(date, DateTimeFormatter.ISO_LOCAL_DATE);
            if (!userRepository.existsById(userId)) {
                return false;
            }

            return reservationRepository.existsActiveReservationByUserIdAndDate(userId, reservationDate);
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public List<CustomerReservationResponse> getCurrentReservationByUser(Integer userId) {
        log.info("Customer ID: {} lấy đặt bàn hiện tại", userId);

        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Không tìm thấy người dùng với ID: " + userId);
        }

        List<Reservation> currentReservations = reservationRepository.findCurrentReservationsByUser(userId);

        return currentReservations.stream()
                .map(this::convertToCustomerResponse)
                .toList();
    }

    // Phương thức chuyển đổi Entity sang Response
    private CustomerReservationResponse convertToCustomerResponse(Reservation reservation) {
        CustomerReservationResponse.CustomerReservationResponseBuilder builder = CustomerReservationResponse.builder()
                .id(reservation.getId())
                .customerName(reservation.getCustomerName())
                .phone(reservation.getPhone())
                .reservationTime(reservation.getReservationTime())
                .note(reservation.getNote())
                .status(reservation.getStatus())
                .createdAt(reservation.getCreatedAt())
                .updatedAt(reservation.getUpdatedAt());

        if (reservation.getTable() != null) {
            builder.tableNumber(reservation.getTable().getTableNumber())
                    .capacity(reservation.getTable().getCapacity())
                    .tableStatus(reservation.getTable().getStatus().name());
        }

        return builder.build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RestaurantTableResponse> getAvailableTables() {
        return tableRepository.findAll().stream()
                .map(t -> RestaurantTableResponse.builder()
                        .id(t.getId())
                        .tableNumber(t.getTableNumber())
                        .capacity(t.getCapacity())
                        .status(t.getStatus().name())
                        .build())
                .toList();
    }
    @Override
    @Transactional(readOnly = true)
    public List<TimeRangeResponse> getBlockedTimeRanges(int tableId, LocalDate date) {

        RestaurantTable table = tableRepository.findById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bàn với ID: " + tableId));

        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);

        List<Reservation> activeReservations = reservationRepository.findActiveReservationsByTableId(tableId);

        List<TimeRangeResponse> blockedRanges = new java.util.ArrayList<>();

        for (Reservation res : activeReservations) {
            LocalDateTime resTime = res.getReservationTime();
            LocalDateTime start = resTime.minusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);
            LocalDateTime end = resTime.plusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);

            // chỉ giữ lại khung có giao với ngày đang xét (tránh trả về noise của ngày khác)
            if (end.isAfter(dayStart) && start.isBefore(dayEnd)) {
                blockedRanges.add(TimeRangeResponse.builder().start(start).end(end).build());
            }
        }

        if (table.getStatus() == TableStatus.SERVING) {
            LocalDateTime servingOrderCreatedAt = orderRepository.findServingOrdersWithDetails(table.getId())
                    .stream().findFirst()
                    .map(Order::getCreatedAt)
                    .orElse(null);

            if (servingOrderCreatedAt != null) {
                LocalDateTime start = servingOrderCreatedAt;
                LocalDateTime end = servingOrderCreatedAt.plusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);

                if (end.isAfter(dayStart) && start.isBefore(dayEnd)) {
                    blockedRanges.add(TimeRangeResponse.builder().start(start).end(end).build());
                }
            }
        }

        return blockedRanges;
    }
}