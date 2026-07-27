package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.order.CreateOrderRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.order.OrderItemRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.order.UpdateOrderItemRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.order.UpdateOrderRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.reservation.CreateReservationRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.MenuItemResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.CreateOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.OrderDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.OrderItemResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.UpdateOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.ReservationDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.table.TableDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.entity.*;
import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderItemStatus;
import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderStatus;
import vn.edu.fpt.swp391.g6.rimsapi.enums.ReservationStatus;
import vn.edu.fpt.swp391.g6.rimsapi.enums.TableStatus;
import vn.edu.fpt.swp391.g6.rimsapi.exception.GlobalExceptionHandler;
import vn.edu.fpt.swp391.g6.rimsapi.exception.TableNotAvailableException;
import vn.edu.fpt.swp391.g6.rimsapi.repository.*;
import vn.edu.fpt.swp391.g6.rimsapi.service.WaiterService;
import vn.edu.fpt.swp391.g6.rimsapi.util.WebSocketBroadcaster;
import vn.edu.fpt.swp391.g6.rimsapi.util.ReservationConflictValidator;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation.TimeRangeResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;


@Service
@RequiredArgsConstructor
public class WaiterServiceImpl implements WaiterService
{
    private final RestaurantTableRepository restaurantTableRepository;
    private final ReservationRepository reservationRepository;
    private final OrderRepository orderRepository;
    private final DishRepository dishRepository;
    private final UserRepository userRepository;
    private final OrderItemRepository orderItemRepository;
    private final ReservationConflictValidator conflictValidator;
    private final WebSocketBroadcaster webSocketBroadcaster;

    @Override
    public List<TableDetailResponse> getAllTables()
    {
        List<RestaurantTable> tables = restaurantTableRepository.findAll();

        //tự động lọc ra các Reservation đang ở trạng thái QUEUED(chỉ lọc trong 1 ngày tới)
        List<Reservation> queuedReservations = reservationRepository.findByStatusAndReservationTimeBetween(ReservationStatus.QUEUED, LocalDateTime.now(), LocalDate.now().atStartOfDay().plusDays(1));

        Map<Integer, Reservation> nextReservations = new HashMap<>();
        for (Reservation res : queuedReservations)
        {
            int tid = res.getTable().getId();
            if (!nextReservations.containsKey(tid) || res.getReservationTime().isBefore(nextReservations.get(tid).getReservationTime()))
            {
                nextReservations.put(tid, res);
            }
        }

        List<TableDetailResponse> tableDetailResponses = new ArrayList<>();
        for (RestaurantTable table : tables)
        {
            TableDetailResponse response = TableDetailResponse.builder()
                    .tableId(table.getId())
                    .tableNumber(table.getTableNumber())
                    .capacity(table.getCapacity())
                    .status(table.getStatus())
                    .build();

            //mapping thời gian / tên khách hàng đặt bàn sớm nhất vào các bàn đang AVAILABLE
            if (table.getStatus() == TableStatus.AVAILABLE && nextReservations.containsKey(table.getId()))
            {
                Reservation nextRes = nextReservations.get(table.getId());
                response.setUpcomingReservationTime(nextRes.getReservationTime());
                response.setUpcomingCustomerName(nextRes.getCustomerName());
            }

            tableDetailResponses.add(response);
        }
        return tableDetailResponses;
    }

    @Override
    @Transactional
    public CreateOrderResponse createOrder(CreateOrderRequest request, Integer waiterId)
    {
        // 1. Validate table
        RestaurantTable table = restaurantTableRepository.findById(request.getTableId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bàn với ID: " + request.getTableId()));

        if (table.getStatus() != TableStatus.AVAILABLE && table.getStatus() != TableStatus.RESERVED)
        {
            throw new TableNotAvailableException(
                    "Bàn " + table.getTableNumber() + " hiện đang " + table.getStatus() + ", không thể tạo đơn.");
        }

        // 2. Load waiter
        User waiter = userRepository.findById(waiterId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy nhân viên với ID: " + waiterId));

        // 3. Build Order
        Order order = new Order();
        order.setTable(table);
        order.setCreatedBy(waiter);
        order.setStatus(OrderStatus.SERVING);
        order.setTotalAmount(BigDecimal.ZERO);
        order.setOrderItems(new ArrayList<>());

        // 4. Build OrderItems + accumulate total
        BigDecimal total = BigDecimal.ZERO;

        for (OrderItemRequest itemReq : request.getItems())
        {
            Dish dish = dishRepository.findById(itemReq.getDishId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy món với ID: " + itemReq.getDishId()));

            BigDecimal unitPrice = BigDecimal.valueOf(dish.getPrice());
            BigDecimal subTotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            total = total.add(subTotal);

            OrderItem orderItem = new OrderItem();
            orderItem.setDish(dish);
            orderItem.setDishNameSnapshot(dish.getName());
            orderItem.setQuantity(itemReq.getQuantity());
            orderItem.setUnitPrice(unitPrice);
            orderItem.setSubTotal(subTotal);
            orderItem.setNote(itemReq.getNote());
            orderItem.setStatus(OrderItemStatus.PREPARING);

            order.addOrderItem(orderItem); // sets back-reference on OrderItem
        }

        order.setTotalAmount(total);

        // 5. Save order (cascades OrderItems)
        orderRepository.save(order);

        // 6. Update table status
        table.setStatus(TableStatus.SERVING);
        restaurantTableRepository.save(table);

        webSocketBroadcaster.broadcastAfterCommit("/topic/kitchen", "REFRESH");
        webSocketBroadcaster.broadcastAfterCommit("/topic/tables", "TABLE_UPDATED");

        // 7. Return response
        return CreateOrderResponse.builder()
                .orderId(order.getId())
                .tableNumber(table.getTableNumber())
                .message("Tạo đơn thành công cho bàn " + table.getTableNumber())
                .totalAmount(total)
                .build();
    }

    @Override
    @Transactional
    public CreateOrderResponse createOrderFromReservation(Long reservationId, CreateOrderRequest request, Integer waiterId)
    {
        // lấy và validate Reservation
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đặt bàn với ID: " + reservationId));

        if (reservation.getStatus() != ReservationStatus.WAITING)
        {
            throw new IllegalStateException("Chỉ có thể nhận bàn khi khách đến đúng khung giờ (Trạng thái WAITING). Vui lòng đợi đến khi bàn chuyển sang trạng thái RESERVED.");
        }

        if (reservation.getTable().getStatus() != TableStatus.RESERVED)
        {
            throw new IllegalStateException("Bàn hiện tại chưa được giữ (Reserved) cho đặt bàn này.");
        }

        //ghi đè Table ID để đảm bảo đồng nhất dữ liệu
        request.setTableId(reservation.getTable().getId());

        reservation.setStatus(ReservationStatus.COMPLETED); //hoàn tất Đặt bàn
        reservationRepository.save(reservation);

        return this.createOrder(request, waiterId); // gọi lại hàm tạo Order như bình thường
    }

    @Override
    @Transactional
    public UpdateOrderResponse updateOrder(Long id, UpdateOrderRequest updateOrderRequest, Integer waiterId)
    {
        // nhận order id để validate (order đang serving và table đang serving)
        // update order request là danh sách (update order items request) bao gồm các món (dish) số lượng món (quantity) và note của món tương ứng

        // các món đã trong trạng thái COMPLETE thì chỉ có thêm số lượng chứ không giảm đi được, tức là số lượng lúc sau phải luôn >= số lượng ban đầu, nếu không thì lỗi
        // còn các món mà trong trạng thái PREPARING thì thêm bớt tùy ý

        Order order = orderRepository.findOrderWithDetailsById(id).orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng với ID: " + id));

        if (!userRepository.existsById(waiterId))
        {
            throw new IllegalArgumentException("Không tìm thấy nhân viên với ID: " + waiterId);
        }

        if (order.getStatus() != OrderStatus.SERVING)
        {
            throw new IllegalArgumentException("Chỉ có thể cập nhật đơn hàng đang phục vụ");
        }

        if (order.getTable().getStatus() != TableStatus.SERVING)
        {
            throw new IllegalArgumentException("Chỉ có thể cập nhật bàn đang ở trạng thái phục vụ");
        }

        // bây giờ đã validate xong order, việc cần làm tiếp theo là đối chiếu order request với order gốc, xem có thay đổi cập nhật gì, lúc này sẽ validate các item trong order

        // vì bên trong order request có các order item request và trong order có các order item, nên bản chất cả bên trong cả 2 là 2 object khác nhau nên không thể so sánh bình thường được.
        // thay vào đó, ta sẽ sử dụng order item id để lọc và tạo trung gian
        for (UpdateOrderItemRequest itemRequest : updateOrderRequest.getItems())
        {
            // cập nhật món cũ
            if (itemRequest.getOrderItemId() != null)
            {
                // kiểm tra validate order item phải ở trong order, nếu không tìm thấy thì để null
                OrderItem existedItem = isExist(itemRequest.getOrderItemId(), order);

                if (existedItem == null)
                {
                    throw new IllegalArgumentException("Không tìm thấy món trong đơn hàng với ID: " + itemRequest.getOrderItemId());
                }

                if (itemRequest.getQuantity() == null || itemRequest.getDishId() == null)
                {
                    throw new IllegalArgumentException("Món trong đơn hàng với ID " + itemRequest.getOrderItemId() + " không được thiếu số lượng hoặc món ăn");
                }

                if (existedItem.getStatus().equals(OrderItemStatus.COMPLETED)) // chỉ có thể thêm số lượng chứ không bớt đi được. nếu thêm số lượng thì sẽ tạo order item mới với số lượng bằng phần dư khi trừ (để không bị trùng)
                {
                    if (itemRequest.getQuantity() < existedItem.getQuantity())
                    {
                        throw new IllegalArgumentException("Món trong đơn hàng với ID " + itemRequest.getOrderItemId() + " đã hoàn thành, không thể giảm số lượng");
                    } else if (itemRequest.getQuantity() > existedItem.getQuantity())
                    {
                        // tạo order item mới đế không bị nhầm lẫn với order item khác
                        OrderItem orderItem = new OrderItem();
                        orderItem.setDish(existedItem.getDish());
                        orderItem.setDishNameSnapshot(existedItem.getDishNameSnapshot());
                        orderItem.setQuantity(itemRequest.getQuantity() - existedItem.getQuantity());
                        orderItem.setUnitPrice(existedItem.getUnitPrice());
                        orderItem.setSubTotal(existedItem.getUnitPrice().multiply(BigDecimal.valueOf(orderItem.getQuantity())));
                        orderItem.setNote(itemRequest.getNote());
                        orderItem.setStatus(OrderItemStatus.PREPARING);
                        order.addOrderItem(orderItem);
                    }
                } else
                {
                    if (itemRequest.getQuantity() == 0)
                    {
                        order.removeOrderItem(existedItem);
                    } else
                    {
                        existedItem.setQuantity(itemRequest.getQuantity());
                        existedItem.setSubTotal(existedItem.getUnitPrice().multiply(BigDecimal.valueOf(itemRequest.getQuantity())));
                        existedItem.setNote(itemRequest.getNote());
                    }
                }
            } else // món mới khi gửi đi sẽ có orderitem id là null
            {
                Dish dish = dishRepository.findById(itemRequest.getDishId())
                        .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy món ăn với ID: " + itemRequest.getDishId()));

                OrderItem orderItem = new OrderItem();
                orderItem.setDish(dish);
                orderItem.setDishNameSnapshot(dish.getName());
                orderItem.setQuantity(itemRequest.getQuantity());
                BigDecimal unitPrice = BigDecimal.valueOf(dish.getPrice());
                orderItem.setUnitPrice(unitPrice);
                orderItem.setSubTotal(unitPrice.multiply(BigDecimal.valueOf(itemRequest.getQuantity())));
                orderItem.setNote(itemRequest.getNote());
                orderItem.setStatus(OrderItemStatus.PREPARING);

                order.addOrderItem(orderItem);
            }
        }

        BigDecimal total = BigDecimal.ZERO;
        for (OrderItem item : order.getOrderItems())
        {
            if (item.getStatus() != OrderItemStatus.CANCELLED) {
                total = total.add(item.getSubTotal());
            }
        }
        order.setTotalAmount(total);
        orderRepository.save(order);

        webSocketBroadcaster.broadcastAfterCommit("/topic/kitchen", "REFRESH");

        return UpdateOrderResponse.builder()
                .orderId(order.getId())
                .tableNumber(order.getTable().getTableNumber())
                .message("Cập nhật đơn hàng thành công cho bàn " + order.getTable().getTableNumber())
                .totalAmount(total)
                .build();
    }

    private OrderItem isExist(Long itemId, Order order)
    {
        for (OrderItem orderItem : order.getOrderItems())
        {
            if (orderItem.getId().equals(itemId))
            {
                return orderItem;
            }
        }
        return null;
    }

    @Override
    public List<MenuItemResponse> getMenu()
    {
        return dishRepository.findByIsHiddenFalse().stream()
                .map(dish -> MenuItemResponse.builder()
                        .dishId(dish.getId())
                        .name(dish.getName())
                        .description(dish.getDescription())
                        .price(dish.getPrice())
                        .imageUrl(dish.getImageUrl())
                        .categoryName(dish.getCategory().getName())
                        .available(dish.isAvailable())
                        .build())
                .toList();
    }

    @Override
    public List<OrderDetailResponse> getServingOrders(int tableId)
    {
        List<Order> orders = orderRepository.findServingOrdersWithDetails(tableId);
        List<OrderDetailResponse> orderDetailResponses = new ArrayList<>();
        for (Order order : orders)
        {
            orderDetailResponses.add(
                    OrderDetailResponse.builder().
                            orderId(order.getId())
                            .tableNumber(order.getTable().getTableNumber())
                            .createdAt(order.getCreatedAt())
                            .orderItems(order.getOrderItems().stream().map(
                                    orderItem ->
                                    {
                                        OrderItemResponse response = new OrderItemResponse();
                                        response.setOrderItemId(orderItem.getId());
                                        response.setDishId(orderItem.getDish().getId());
                                        response.setDishName(orderItem.getDishNameSnapshot());
                                        response.setStatus(orderItem.getStatus());
                                        response.setQuantity(orderItem.getQuantity());
                                        response.setUnitPrice(orderItem.getUnitPrice());
                                        response.setSubTotal(orderItem.getSubTotal());
                                        response.setCancelReason(orderItem.getCancelReason());
                                        response.setNote(orderItem.getNote());

                                        // Ghi chú Chef gửi cho Waiter
                                        response.setChefInternalNote(orderItem.getChefInternalNote());

                                        // Thời điểm Chef gửi note
                                        response.setChefInternalNoteCreatedAt(orderItem.getChefInternalNoteCreatedAt());

                                        // Thời điểm Waiter xác nhận đã xem
                                        response.setChefInternalNoteAcknowledgedAt(orderItem.getChefInternalNoteAcknowledgedAt());
                                        return response;
                                    }
                            ).toList())
                            .build()
            );
        }
        return orderDetailResponses;
    }

    @Override
    @Transactional
    public String createReservation(CreateReservationRequest request)
    {
        RestaurantTable table = restaurantTableRepository.findByIdForUpdate(request.getTableId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bàn với ID: " + request.getTableId()));
        if (request.getReservationTime().isBefore(LocalDateTime.now()))
        {
            throw new IllegalArgumentException("Thời gian đặt bàn phải ở trong tương lai.");
        }

        LocalTime time = request.getReservationTime().toLocalTime();
        LocalTime openTime = LocalTime.of(8, 0);
        LocalTime closeTime = LocalTime.of(20, 0);

        if (time.isBefore(openTime) || time.isAfter(closeTime)) {
            throw new GlobalExceptionHandler.BusinessException("Nhà hàng chỉ nhận đặt bàn trong khoảng 08:00 - 20:00");
        }

        // Chặn 1 số điện thoại có nhiều hơn 1 đặt bàn đang hoạt động trong cùng 1 ngày
        LocalDate reservationDate = request.getReservationTime().toLocalDate();
        List<Reservation> phoneReservations = reservationRepository
                .findActiveReservationsByPhoneAndDate(request.getPhone(), reservationDate);

        if (!phoneReservations.isEmpty()) {
            throw new IllegalArgumentException(
                    "Số điện thoại này đã có một đặt bàn đang hoạt động trong ngày này, vui lòng hủy đặt bàn cũ trước khi đặt bàn mới.");
        }

        LocalDateTime start = request.getReservationTime().minusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);
        LocalDateTime end = request.getReservationTime().plusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);

        List<Reservation> existingReservations = reservationRepository.findByTableIdAndReservationTimeBetweenAndStatusIn(request.getTableId(), start, end, List.of(ReservationStatus.QUEUED, ReservationStatus.WAITING));

        LocalDateTime servingOrderCreatedAt = null;
        if (table.getStatus() == TableStatus.SERVING)
        {
            servingOrderCreatedAt = orderRepository.findServingOrdersWithDetails(table.getId())
                    .stream().findFirst()
                    .map(Order::getCreatedAt)
                    .orElse(null);
        }

        if (conflictValidator.hasConflict(existingReservations, request.getReservationTime(), null, servingOrderCreatedAt)) {
            throw new IllegalArgumentException("Bàn đã được đặt trong khoảng thời gian này, các đơn phải cách nhau ít nhất 2.5 tiếng.");
        }

        Reservation reservation = new Reservation();
        reservation.setCustomerName(request.getCustomerName());
        reservation.setPhone(request.getPhone());
        reservation.setNote(request.getNote());
        reservation.setReservationTime(request.getReservationTime());
        reservation.setTable(table);
        reservation.setStatus(ReservationStatus.QUEUED);

        reservationRepository.save(reservation);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH 'giờ' mm 'phút,' EEEE 'ngày' dd 'tháng' MM 'năm' yyyy", Locale.of("vi", "VN"));

        return "Tạo đơn đặt bàn thành công cho bàn" + table.getTableNumber() + " vào " + request.getReservationTime().format(formatter);
    }

    @Override
    public List<ReservationDetailResponse> viewReservationsByTableAndTime(int tableId, LocalDate date)
    {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = start.plusDays(1);

        // tìm reservation tương ứng với số bàn và ngày, lúc này dữ liệu sẽ ra 1 list
        return reservationRepository
                .findByTableIdAndReservationTimeBetweenAndStatusIn(tableId, start, end, List.of(ReservationStatus.QUEUED, ReservationStatus.WAITING))
                .stream().map(this::toReservationResponse).toList();
    }

    @Override
    public ReservationDetailResponse viewReservationDetail(Long reservationId)
    {
        return reservationRepository.findById(reservationId)
                .map(this::toReservationResponse)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy chi tiết đặt bàn với ID: " + reservationId));
    }

    @Override
    public ReservationDetailResponse getCurrentReservationByTable(int tableId)
    {
        RestaurantTable table = restaurantTableRepository.findById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bàn với ID: " + tableId));

        if (table.getStatus() != TableStatus.RESERVED)
        {
            throw new IllegalArgumentException("Bàn " + tableId + " không ở trạng thái RESERVED");
        }

        Reservation reservation = reservationRepository
                .findFirstByTableIdAndStatus(tableId, ReservationStatus.WAITING)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đặt bàn WAITING cho bàn " + tableId));

        return toReservationResponse(reservation);
    }

    private ReservationDetailResponse toReservationResponse(Reservation reservation)
    {
        return ReservationDetailResponse.builder()
                .reservationId(reservation.getId())
                .customerName(reservation.getCustomerName())
                .phone(reservation.getPhone())
                .note(reservation.getNote())
                .tableId(reservation.getTable().getId())
                .status(reservation.getStatus())
                .reservationTime(reservation.getReservationTime())
                .build();
    }

    @Override
    @Transactional
    public String updateReservation(Long reservationId, CreateReservationRequest request)
    {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt bàn với ID: " + reservationId));

        RestaurantTable table = restaurantTableRepository.findByIdForUpdate(request.getTableId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bàn với ID: " + request.getTableId()));

        if (request.getReservationTime().isBefore(LocalDateTime.now()))
        {
            throw new IllegalArgumentException("Thời gian đặt bàn phải ở trong tương lai.");
        }

        // Chặn 1 số điện thoại có nhiều hơn 1 đặt bàn đang hoạt động trong cùng 1 ngày
        // (loại trừ chính reservation đang sửa)
        LocalDate reservationDate = request.getReservationTime().toLocalDate();
        List<Reservation> phoneReservations = reservationRepository
                .findActiveReservationsByPhoneAndDate(request.getPhone(), reservationDate);

        boolean hasOtherActiveReservation = phoneReservations.stream()
                .anyMatch(r -> !r.getId().equals(reservationId));

        if (hasOtherActiveReservation) {
            throw new IllegalArgumentException(
                    "Số điện thoại này đã có một đặt bàn khác đang hoạt động trong ngày này.");
        }

        LocalDateTime start = request.getReservationTime().minusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);
        LocalDateTime end = request.getReservationTime().plusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);

        List<Reservation> existingReservations = reservationRepository.findByTableIdAndReservationTimeBetweenAndStatusIn(
                request.getTableId(), start, end, List.of(ReservationStatus.WAITING,  ReservationStatus.QUEUED));

        LocalDateTime servingOrderCreatedAt = null;
        if (table.getStatus() == TableStatus.SERVING)
        {
            servingOrderCreatedAt = orderRepository.findServingOrdersWithDetails(table.getId())
                    .stream().findFirst()
                    .map(Order::getCreatedAt)
                    .orElse(null);
        }

        if (conflictValidator.hasConflict(existingReservations, request.getReservationTime(), reservationId, servingOrderCreatedAt)) {
            throw new IllegalArgumentException("Bàn đã được đặt trong khoảng thời gian này, các đơn phải cách nhau ít nhất 2.5 tiếng.");
        }

        reservation.setCustomerName(request.getCustomerName());
        reservation.setPhone(request.getPhone());
        reservation.setNote(request.getNote());
        reservation.setReservationTime(request.getReservationTime());
        reservation.setTable(table);

        reservationRepository.save(reservation);
        return "Cập nhật đặt bàn thành công";
    }

    @Override
    @Transactional
    public String cancelReservation(Long reservationId)
    {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn đặt bàn với ID: " + reservationId));

        if (reservation.getStatus() == ReservationStatus.CANCELLED
                || reservation.getStatus() == ReservationStatus.COMPLETED)
        {
            throw new IllegalArgumentException("Đặt bàn này đã "
                    + (reservation.getStatus() == ReservationStatus.COMPLETED ? "hoàn tất" : "bị hủy")
                    + " trước đó, không thể hủy lại.");
        }

        boolean tableReleased = false;
        if (reservation.getStatus() == ReservationStatus.WAITING)
        {
            RestaurantTable currentTable = restaurantTableRepository.findByIdForUpdate(reservation.getTable().getId()).orElse(null);
            if (currentTable != null && currentTable.getStatus() == TableStatus.RESERVED)
            {
                currentTable.setStatus(TableStatus.AVAILABLE);
                restaurantTableRepository.save(currentTable);
                tableReleased = true;
            }
        }

        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        if (tableReleased)
        {
            webSocketBroadcaster.broadcastAfterCommit("/topic/tables", "TABLE_UPDATED");
        }

        return "Hủy đặt bàn thành công";
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void autoUpdateTableStatusToReserved()
    {
        LocalDateTime now = LocalDateTime.now();

        List<Reservation> reservations = reservationRepository
                .findByStatusAndReservationTimeBetween(ReservationStatus.QUEUED, now, now.plusMinutes(30));

        boolean changed = false;

        for (Reservation res : reservations)
        {
            RestaurantTable currentTable = restaurantTableRepository.findByIdForUpdate(res.getTable().getId()).orElse(null);
            if (currentTable == null) continue;

            if (currentTable.getStatus() == TableStatus.AVAILABLE)
            {
                res.setStatus(ReservationStatus.WAITING);
                currentTable.setStatus(TableStatus.RESERVED);
                changed = true;
            } else if (currentTable.getStatus() == TableStatus.SERVING)
            {
                int requiredCapacity = currentTable.getCapacity() != null ? currentTable.getCapacity() : 0;

                List<RestaurantTable> alternatives = restaurantTableRepository
                        .findByStatusAndCapacityGreaterThanEqual(TableStatus.AVAILABLE, requiredCapacity);

                alternatives.removeIf(t -> Objects.equals(t.getId(), currentTable.getId()));

                if (!alternatives.isEmpty())
                {
                    RestaurantTable newTable = alternatives.stream().min(Comparator.comparingInt(t -> t.getCapacity() != null ? t.getCapacity() : 0)).get();

                    res.setTable(newTable);
                    res.setStatus(ReservationStatus.WAITING);
                    newTable.setStatus(TableStatus.RESERVED);
                    changed = true;
                } else
                {
                    res.setStatus(ReservationStatus.CANCELLED);
                }
            }
        }

        if (changed)
        {
            webSocketBroadcaster.broadcastAfterCommit("/topic/tables", "TABLE_UPDATED");
        }
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void autoCancelReservation()
    {
        LocalDateTime now = LocalDateTime.now();

        List<Reservation> expiredReservations = reservationRepository
                .findByStatusAndReservationTimeBefore(ReservationStatus.WAITING, now.minusMinutes(15));

        boolean changed = false;

        for (Reservation res : expiredReservations)
        {
            res.setStatus(ReservationStatus.CANCELLED);
            res.getTable().setStatus(TableStatus.AVAILABLE);
            changed = true;
        }

        if (changed)
        {
            webSocketBroadcaster.broadcastAfterCommit("/topic/tables", "TABLE_UPDATED");
        }
    }

    @Override
    @Transactional
    public void acknowledgeChefInternalNote(Long orderItemId)
    {
        OrderItem orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy món với ID: " + orderItemId));

        //Nếu Waiter đã xem rồi thì không cập nhật lại thời gian.
        if (orderItem.getChefInternalNoteAcknowledgedAt() == null)
        {
            orderItem.setChefInternalNoteAcknowledgedAt(LocalDateTime.now());
            orderItemRepository.save(orderItem);
            webSocketBroadcaster.broadcastAfterCommit("/topic/kitchen", "NOTE_ACKNOWLEDGED");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<TimeRangeResponse> getBlockedTimeRanges(int tableId, LocalDate date, Long excludeReservationId)
    {
        RestaurantTable table = restaurantTableRepository.findById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bàn với ID: " + tableId));

        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);

        List<Reservation> activeReservations = reservationRepository.findActiveReservationsByTableId(tableId);

        List<TimeRangeResponse> blockedRanges = new ArrayList<>();

        for (Reservation res : activeReservations)
        {
            if (excludeReservationId != null && excludeReservationId.equals(res.getId()))
            {
                continue;
            }

            LocalDateTime resTime = res.getReservationTime();
            LocalDateTime start = resTime.minusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);
            LocalDateTime end = resTime.plusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);

            if (end.isAfter(dayStart) && start.isBefore(dayEnd))
            {
                blockedRanges.add(TimeRangeResponse.builder().start(start).end(end).build());
            }
        }

        if (table.getStatus() == TableStatus.SERVING)
        {
            LocalDateTime servingOrderCreatedAt = orderRepository.findServingOrdersWithDetails(table.getId())
                    .stream().findFirst()
                    .map(Order::getCreatedAt)
                    .orElse(null);

            if (servingOrderCreatedAt != null)
            {
                LocalDateTime start = servingOrderCreatedAt;
                LocalDateTime end = servingOrderCreatedAt.plusMinutes(ReservationConflictValidator.TABLE_TURNAROUND_MINUTES);

                if (end.isAfter(dayStart) && start.isBefore(dayEnd))
                {
                    blockedRanges.add(TimeRangeResponse.builder().start(start).end(end).build());
                }
            }
        }

        return blockedRanges;
    }
}
