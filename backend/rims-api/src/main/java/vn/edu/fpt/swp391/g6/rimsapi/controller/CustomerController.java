package vn.edu.fpt.swp391.g6.rimsapi.controller;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.reservation.CustomerCreateReservationRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.user.ChangePasswordRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.user.UpdateAccountRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.CustomerReservationResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.RestaurantTableResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.TimeRangeResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserResponse;
import vn.edu.fpt.swp391.g6.rimsapi.security.UserPrincipal;
import vn.edu.fpt.swp391.g6.rimsapi.service.CustomerService;
import vn.edu.fpt.swp391.g6.rimsapi.service.UserService;

@RestController
@RequestMapping("/rims/customer")
@RequiredArgsConstructor
public class CustomerController
{

    private final UserService userService;
    private final CustomerService customerService;

    // ========== Profile Management ==========
    @GetMapping("/profile")
    public UserResponse getMyProfile(@AuthenticationPrincipal UserPrincipal principal)
    {
        return userService.getAccountDetail(principal.getId());
    }

    @PutMapping("/profile")
    public UserResponse updateMyProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody @Valid UpdateAccountRequest request)
    {
        return userService.updateAccount(principal.getId(), request);
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody @Valid ChangePasswordRequest request)
    {
        userService.changePassword(principal, request);
        return ResponseEntity.noContent().build();
    }

    // ========== Table Management for Customer ==========
    @GetMapping("/tables/available")
    public ResponseEntity<List<RestaurantTableResponse>> getAvailableTables()
    {
        try
        {
            List<RestaurantTableResponse> response = customerService.getAvailableTables();
            return ResponseEntity.ok(response);
        } catch (Exception e)
        {
            return ResponseEntity.ok(List.of());
        }
    }

    // ========== Reservation Management for Customer ==========

    /**
     * Đặt bàn - Customer chỉ được đặt 1 bàn/ngày
     * POST /rims/customer/reservations
     */
    @PostMapping("/reservations")
    public ResponseEntity<CustomerReservationResponse> createReservation(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody @Valid CustomerCreateReservationRequest request)
    {

        request.setUserId(principal.getId());
        CustomerReservationResponse response = customerService.createReservation(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Hủy đặt bàn - Nhận reservationId từ path variable
     * DELETE /rims/customer/reservations/{reservationId}/cancel
     *
     * Không dùng @RequestBody cho DELETE nữa: nhiều client (axios .delete(), một số
     * proxy/gateway) không gửi body kèm request DELETE theo mặc định, dẫn tới lỗi
     * "Required request body is missing" dù backend code không sai gì. Path variable
     * không có khái niệm "quên gửi" — nếu thiếu, Spring trả 404 (không khớp route)
     * thay vì 400 mơ hồ như cũ.
     */
    @DeleteMapping("/reservations/{reservationId}/cancel")
    public ResponseEntity<CustomerReservationResponse> cancelReservation(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long reservationId)
    {

        CustomerReservationResponse response = customerService.cancelReservation(
                principal.getId(),
                reservationId);
        return ResponseEntity.ok(response);
    }

    /**
     * Lấy đặt bàn hiện tại của customer
     * GET /rims/customer/reservations/current
     */
    @GetMapping("/reservations/current")
    public ResponseEntity<List<CustomerReservationResponse>> getCurrentReservation(
            @AuthenticationPrincipal UserPrincipal principal)
    {

        List<CustomerReservationResponse> response = customerService.getCurrentReservationByUser(principal.getId());
        return ResponseEntity.ok(response);
    }

    /**
     * Kiểm tra đã đặt bàn trong ngày chưa
     * GET /rims/customer/reservations/check?date=2026-07-08
     */
    @GetMapping("/reservations/check")
    public ResponseEntity<Boolean> checkCustomerReservation(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam String date)
    {

        boolean exists = customerService.checkCustomerReservationByUser(principal.getId(), date);
        return ResponseEntity.ok(exists);
    }

    /**
     * Lấy các khung giờ bị chặn (không đặt được) của 1 bàn trong 1 ngày.
     * GET /rims/customer/tables/{tableId}/blocked-slots?date=2026-07-23
     */
    @GetMapping("/tables/{tableId}/blocked-slots")
    public ResponseEntity<List<TimeRangeResponse>> getBlockedTimeRanges(
            @PathVariable int tableId,
            @RequestParam String date)
    {
        LocalDate parsedDate = LocalDate.parse(date, DateTimeFormatter.ISO_LOCAL_DATE);
        return ResponseEntity.ok(customerService.getBlockedTimeRanges(tableId, parsedDate));
    }
}
