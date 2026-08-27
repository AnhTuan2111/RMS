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
import vn.edu.fpt.swp391.g6.rimsapi.security.UserPrincipal;
import vn.edu.fpt.swp391.g6.rimsapi.service.WaiterService;

@RestController
@RequestMapping("/rims/waiter")
@RequiredArgsConstructor
public class WaiterController
{
    private final WaiterService waiterService;

    @GetMapping("/tables")
    public ResponseEntity<List<TableDetailResponse>> getWaiterTables()
    {
        return ResponseEntity.ok(waiterService.getAllTables());
    }

    @PostMapping("/orders")
    public ResponseEntity<CreateOrderResponse> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal)
    {
        CreateOrderResponse response = waiterService.createOrder(request, userPrincipal.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/orders/{orderId}")
    public ResponseEntity<UpdateOrderResponse> updateOrder(
            @PathVariable Long orderId,
            @Valid @RequestBody UpdateOrderRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal)
    {
        UpdateOrderResponse response = waiterService.updateOrder(orderId, request, userPrincipal.getId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/menu")
    public ResponseEntity<List<MenuItemResponse>> getMenu()
    {
        return ResponseEntity.ok(waiterService.getMenu());
    }

    @GetMapping("/detail/{tableId}")
    public ResponseEntity<List<OrderDetailResponse>> getOrderDetailByTableId(@PathVariable int tableId)
    {
        return ResponseEntity.ok(waiterService.getServingOrders(tableId));
    }

    @GetMapping("/reservation/{tableId}/{date}")
    public ResponseEntity<List<ReservationDetailResponse>> getAllReservationsByTableAndDate(@PathVariable int tableId,
            @PathVariable LocalDate date)
    {
        return ResponseEntity.ok(waiterService.viewReservationsByTableAndTime(tableId, date));
    }

    @GetMapping("/reservation/detail/{tableId}")
    public ResponseEntity<ReservationDetailResponse> getReservationByTable(@PathVariable int tableId)
    {
        return ResponseEntity.ok(waiterService.getCurrentReservationByTable(tableId));
    }

    @PostMapping("/reservations")
    public ResponseEntity<String> createReservation(@Valid @RequestBody CreateReservationRequest request)
    {
        return ResponseEntity.status(HttpStatus.CREATED).body(waiterService.createReservation(request));
    }

    @PostMapping("/reservations/{reservationId}/orders")
    public ResponseEntity<CreateOrderResponse> createOrderFromReservation(
            @PathVariable Long reservationId,
            @Valid @RequestBody CreateOrderRequest request,
            @AuthenticationPrincipal UserPrincipal userPrincipal)
    {
        CreateOrderResponse response = waiterService.createOrderFromReservation(reservationId, request,
                userPrincipal.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/reservations/{reservationId}")
    public ResponseEntity<ReservationDetailResponse> getReservationDetail(@PathVariable Long reservationId)
    {
        return ResponseEntity.ok(waiterService.viewReservationDetail(reservationId));
    }

    @PutMapping("/reservations/{reservationId}")
    public ResponseEntity<String> updateReservation(
            @PathVariable Long reservationId,
            @Valid @RequestBody CreateReservationRequest request)
    {
        return ResponseEntity.ok(waiterService.updateReservation(reservationId, request));
    }

    @PutMapping("/reservations/{reservationId}/cancel")
    public ResponseEntity<String> cancelReservation(@PathVariable Long reservationId)
    {
        return ResponseEntity.ok(waiterService.cancelReservation(reservationId));
    }

    @PutMapping("/order-items/{orderItemId}/chef-note/acknowledge")
    public ResponseEntity<Void> acknowledgeChefInternalNote(@PathVariable Long orderItemId)
    {
        waiterService.acknowledgeChefInternalNote(orderItemId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tables/{tableId}/blocked-slots")
    public ResponseEntity<List<TimeRangeResponse>> getBlockedTimeRanges(
            @PathVariable int tableId,
            @RequestParam String date,
            @RequestParam(required = false) Long excludeReservationId)
    {
        LocalDate parsedDate = LocalDate.parse(date, DateTimeFormatter.ISO_LOCAL_DATE);
        return ResponseEntity.ok(waiterService.getBlockedTimeRanges(tableId, parsedDate, excludeReservationId));
    }
}
