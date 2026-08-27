package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.transaction.Transactional;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import vn.edu.fpt.swp391.g6.rimsapi.dto.response.kitchen.ChefDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.kitchen.KitchenOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishListResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.CancelledOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.GroupedKitchenItemResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.GroupedKitchenOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Dish;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Order;
import vn.edu.fpt.swp391.g6.rimsapi.entity.OrderItem;
import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderItemStatus;
import vn.edu.fpt.swp391.g6.rimsapi.repository.DishRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.OrderItemRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.OrderRepository;
import vn.edu.fpt.swp391.g6.rimsapi.service.ChefService;
import vn.edu.fpt.swp391.g6.rimsapi.util.WebSocketBroadcaster;

@Service
@RequiredArgsConstructor
public class ChefServiceImpl implements ChefService
{

    private final OrderItemRepository orderItemRepository;
    private final DishRepository dishRepository;
    private final OrderRepository orderRepository;
    private final WebSocketBroadcaster webSocketBroadcaster;

    @Override
    public List<KitchenOrderResponse> getKitchenOrders()
    {
        return orderItemRepository
                .findByStatusOrderByCreatedAtAsc(
                        OrderItemStatus.PREPARING)
                .stream()
                .map(this::toKitchenOrderResponse)
                .toList();
    }

    @Override
    public DishDetailResponse getDishDetail(
            Long orderItemId)
    {
        OrderItem item = findOrderItem(orderItemId);

        if (item.getStatus() != OrderItemStatus.PREPARING)
        {
            throw new IllegalStateException(
                    "Chỉ có thể xem chi tiết món đang chuẩn bị");
        }

        DishDetailResponse response = new DishDetailResponse();

        response.setOrderItemId(item.getId());

        response.setTableNumber(
                item.getOrder()
                        .getTable()
                        .getTableNumber());

        response.setDishName(
                item.getDishNameSnapshot());

        response.setDescription(
                item.getDish().getDescription());
        response.setQuantity(
                item.getQuantity());

        response.setNote(
                item.getNote());

        response.setStatus(
                item.getStatus());

        response.setCreatedAt(
                item.getCreatedAt());

        response.setChefInternalNote(
                item.getChefInternalNote());

        response.setChefInternalNoteCreatedAt(
                item.getChefInternalNoteCreatedAt());

        response.setChefInternalNoteAcknowledgedAt(
                item.getChefInternalNoteAcknowledgedAt());

        return response;
    }

    @Override
    @Transactional
    public void updateDishStatus(
            Long orderItemId,
            OrderItemStatus status)
    {
        OrderItem item = findOrderItem(orderItemId);

        if (item.getStatus() != OrderItemStatus.PREPARING)
        {
            throw new IllegalStateException(
                    "Món đã được hoàn thành hoặc đã hủy");
        }

        if (status == null)
        {
            throw new IllegalArgumentException(
                    "Trạng thái món không được để trống");
        }

        item.setStatus(status);

        orderItemRepository.save(item);
        webSocketBroadcaster.broadcastAfterCommit("/topic/waiter", "DISH_READY");
    }

    @Override
    public List<DishListResponse> getDishList()
    {
        return dishRepository.findByIsHiddenFalse()
                .stream()
                .map(dish -> {
                    DishListResponse response = new DishListResponse();

                    response.setDishId(
                            dish.getId());

                    response.setDishName(
                            dish.getName());

                    response.setCategory(
                            dish.getCategory().getName());

                    response.setPrice(
                            dish.getPrice());

                    response.setAvailable(
                            dish.isAvailable());

                    return response;
                })
                .toList();
    }

    @Override
    @Transactional
    public void updateMenuStatus(
            Integer dishId,
            Boolean available)
    {
        Dish dish = dishRepository
                .findById(dishId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Không tìm thấy món ăn"));

        if (available == null)
        {
            throw new IllegalArgumentException(
                    "Trạng thái phục vụ không được để trống");
        }

        dish.setAvailable(available);

        /*
         * Khi đặt món thành hết:
         * hủy tất cả OrderItem của món đó đang PREPARING.
         */
        if (!available)
        {
            cancelAllPreparingItemsOfDish(
                    dish,
                    "Món đã được Chef đánh dấu hết trong thực đơn");
        }

        dishRepository.save(dish);

        webSocketBroadcaster.broadcastAfterCommit("/topic/waiter", "DISH_READY");
    }

    @Override
    public ChefDashboardResponse getDashboard()
    {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1).minusNanos(1);

        long preparingCount = orderItemRepository.countByStatus(
                OrderItemStatus.PREPARING);

        long completedCount = orderItemRepository.countByStatusAndCreatedAtBetween(
                OrderItemStatus.COMPLETED, startOfDay, endOfDay);

        long cancelledCount = orderItemRepository.countByStatusAndCreatedAtBetween(
                OrderItemStatus.CANCELLED, startOfDay, endOfDay);

        long unavailableDishCount = dishRepository.countByIsAvailableFalse();

        return ChefDashboardResponse.builder()
                .preparingCount(preparingCount)
                .completedCount(completedCount)
                .cancelledCount(cancelledCount)
                .unavailableDishCount(
                        unavailableDishCount)
                .build();
    }

    @Override
    @Transactional
    public void requestCancel(Long orderItemId, String reason)
    {
        OrderItem selectedItem = findOrderItem(orderItemId);

        if (selectedItem.getStatus() != OrderItemStatus.PREPARING)
        {
            throw new IllegalStateException("Chỉ có thể hủy món đang chuẩn bị");
        }

        String normalizedReason = reason == null ? "" : reason.trim();

        // Hủy trong chi tiết món: chỉ hủy đúng OrderItem được chọn.
        selectedItem.setStatus(OrderItemStatus.CANCELLED);
        selectedItem.setCancelReason(normalizedReason);
        selectedItem.setCancelRequestedAt(LocalDateTime.now());
        orderItemRepository.save(selectedItem);
        recalculateOrderTotal(selectedItem.getOrder());

        webSocketBroadcaster.broadcastAfterCommit("/topic/waiter", "DISH_READY");
    }

    @Override
    public List<KitchenOrderResponse> getCompletedOrders()
    {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1).minusNanos(1);

        return orderItemRepository
                .findByStatusAndCreatedAtBetweenOrderByCreatedAtAsc(
                        OrderItemStatus.COMPLETED, startOfDay, endOfDay)
                .stream()
                .map(this::toKitchenOrderResponse)
                .toList();
    }

    @Override
    public List<CancelledOrderResponse> getCancelledOrders()
    {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay(); // MỚI
        LocalDateTime endOfDay = startOfDay.plusDays(1).minusNanos(1); // MỚI

        return orderItemRepository
                .findByStatusAndCreatedAtBetweenOrderByCreatedAtAsc(OrderItemStatus.CANCELLED, startOfDay, endOfDay) // ĐỔI
                .stream()
                .map(item -> {
                    CancelledOrderResponse response = new CancelledOrderResponse();
                    response.setOrderItemId(item.getId());
                    response.setOrderId(item.getOrder().getId());
                    response.setTableNumber(item.getOrder().getTable().getTableNumber());
                    response.setDishName(item.getDishNameSnapshot());
                    response.setQuantity(item.getQuantity());
                    response.setCancelReason(item.getCancelReason());
                    response.setCancelledAt(item.getCancelRequestedAt());
                    return response;
                })
                .toList();
    }

    @Override
    @Transactional
    public DishDetailResponse updateChefInternalNote(
            Long orderItemId,
            String note)
    {
        OrderItem item = findOrderItem(orderItemId);

        if (item.getStatus() != OrderItemStatus.PREPARING)
        {
            throw new IllegalStateException(
                    "Chỉ có thể thêm ghi chú cho món đang chuẩn bị");
        }

        String normalizedNote = note == null
                ? ""
                : note.trim();

        if (normalizedNote.length() > 500)
        {
            throw new IllegalArgumentException(
                    "Ghi chú nội bộ không được vượt quá 500 ký tự");
        }

        if (normalizedNote.isBlank())
        {
            item.setChefInternalNote(null);
            item.setChefInternalNoteCreatedAt(null);
            item.setChefInternalNoteAcknowledgedAt(null);
        } else
        {
            item.setChefInternalNote(
                    normalizedNote);

            item.setChefInternalNoteCreatedAt(
                    LocalDateTime.now());

            item.setChefInternalNoteAcknowledgedAt(null);
        }

        orderItemRepository.save(item);
        webSocketBroadcaster.broadcastAfterCommit("/topic/waiter", "DISH_READY");

        return getDishDetail(orderItemId);
    }

    @Override
    public List<GroupedKitchenOrderResponse> getGroupedKitchenOrders()
    {
        List<OrderItem> preparingItems = orderItemRepository
                .findByStatusOrderByCreatedAtAsc(
                        OrderItemStatus.PREPARING);

        Map<String, GroupedKitchenOrderResponse> groupMap = new LinkedHashMap<>();

        for (OrderItem item : preparingItems)
        {
            String normalizedNote = normalizeKitchenNote(
                    item.getNote());

            String groupKey = buildKitchenGroupKey(item);

            GroupedKitchenOrderResponse group = groupMap.computeIfAbsent(
                    groupKey,
                    ignored -> createKitchenGroup(
                            item,
                            groupKey,
                            normalizedNote));

            GroupedKitchenItemResponse itemResponse = new GroupedKitchenItemResponse();

            itemResponse.setOrderItemId(
                    item.getId());

            itemResponse.setOrderId(
                    item.getOrder().getId());

            itemResponse.setTableNumber(
                    item.getOrder()
                            .getTable()
                            .getTableNumber());

            itemResponse.setQuantity(
                    item.getQuantity());

            itemResponse.setCreatedAt(
                    item.getCreatedAt());

            group.getItems().add(itemResponse);

            group.setTotalQuantity(
                    group.getTotalQuantity()
                            + item.getQuantity());

            if (group.getEarliestCreatedAt() == null
                    || (item.getCreatedAt() != null
                            && item.getCreatedAt().isBefore(
                                    group.getEarliestCreatedAt())))
            {
                group.setEarliestCreatedAt(
                        item.getCreatedAt());
            }
        }

        return groupMap.values()
                .stream()
                .sorted(
                        Comparator
                                .comparing(
                                        GroupedKitchenOrderResponse::getEarliestCreatedAt,
                                        Comparator.nullsLast(
                                                Comparator.naturalOrder()))
                                .thenComparing(
                                        group -> group.isHasNote()
                                                ? 0
                                                : 1)
                                .thenComparing(
                                        GroupedKitchenOrderResponse::getTotalQuantity,
                                        Comparator.reverseOrder())
                                .thenComparing(
                                        GroupedKitchenOrderResponse::getDishName,
                                        String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Override
    @Transactional
    public void completeGroupedKitchenOrders(
            List<Long> orderItemIds)
    {
        if (orderItemIds == null
                || orderItemIds.isEmpty())
        {
            throw new IllegalArgumentException(
                    "Danh sách orderItemId không được để trống");
        }

        List<Long> uniqueIds = orderItemIds.stream()
                .distinct()
                .toList();

        List<OrderItem> items = new ArrayList<>();

        orderItemRepository
                .findAllById(uniqueIds)
                .forEach(items::add);

        if (items.size() != uniqueIds.size())
        {
            throw new IllegalArgumentException(
                    "Có OrderItem không tồn tại");
        }

        boolean containsInvalidStatus = items.stream()
                .anyMatch(
                        item -> item.getStatus() != OrderItemStatus.PREPARING);

        if (containsInvalidStatus)
        {
            throw new IllegalStateException(
                    "Tất cả món trong nhóm phải đang ở trạng thái PREPARING");
        }

        Set<String> groupKeys = items.stream()
                .map(this::buildKitchenGroupKey)
                .collect(Collectors.toSet());

        if (groupKeys.size() != 1)
        {
            throw new IllegalArgumentException(
                    "Các OrderItem không thuộc cùng một nhóm nấu");
        }

        for (OrderItem item : items)
        {
            item.setStatus(
                    OrderItemStatus.COMPLETED);
        }

        orderItemRepository.saveAll(items);
        webSocketBroadcaster.broadcastAfterCommit("/topic/waiter", "DISH_READY");
    }

    private void cancelAllPreparingItemsOfDish(
            Dish dish,
            String reason)
    {
        LocalDateTime cancelledAt = LocalDateTime.now();

        List<OrderItem> preparingItemsOfDish = orderItemRepository
                .findByStatusOrderByCreatedAtAsc(
                        OrderItemStatus.PREPARING)
                .stream()
                .filter(item -> item.getDish() != null
                        && Objects.equals(
                                item.getDish().getId(),
                                dish.getId()))
                .toList();

        for (OrderItem item : preparingItemsOfDish)
        {
            item.setStatus(
                    OrderItemStatus.CANCELLED);

            item.setCancelReason(reason);

            item.setCancelRequestedAt(
                    cancelledAt);
        }

        if (!preparingItemsOfDish.isEmpty())
        {
            orderItemRepository.saveAll(
                    preparingItemsOfDish);
            Set<Order> affectedOrders = preparingItemsOfDish.stream()
                    .map(OrderItem::getOrder)
                    .collect(Collectors.toSet());
            for (Order order : affectedOrders)
            {
                recalculateOrderTotal(order);
            }
        }
    }

    private void recalculateOrderTotal(Order order)
    {
        BigDecimal total = order.getOrderItems().stream()
                .filter(item -> item.getStatus() != OrderItemStatus.CANCELLED)
                .map(OrderItem::getSubTotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setTotalAmount(total);
        orderRepository.save(order);
    }

    private OrderItem findOrderItem(
            Long orderItemId)
    {
        return orderItemRepository
                .findById(orderItemId)
                .orElseThrow(
                        () -> new RuntimeException(
                                "Không tìm thấy món trong đơn hàng"));
    }

    private KitchenOrderResponse toKitchenOrderResponse(
            OrderItem item)
    {
        KitchenOrderResponse response = new KitchenOrderResponse();

        response.setOrderItemId(
                item.getId());

        response.setOrderId(
                item.getOrder().getId());

        response.setTableNumber(
                item.getOrder()
                        .getTable()
                        .getTableNumber());

        response.setDishName(
                item.getDishNameSnapshot());

        response.setQuantity(
                item.getQuantity());

        response.setStatus(
                item.getStatus());

        response.setCreatedAt(
                item.getCreatedAt());

        return response;
    }

    private GroupedKitchenOrderResponse createKitchenGroup(
            OrderItem item,
            String groupKey,
            String normalizedNote)
    {
        GroupedKitchenOrderResponse group = new GroupedKitchenOrderResponse();

        group.setGroupKey(groupKey);

        group.setDishId(
                item.getDish().getId());

        group.setDishName(
                item.getDishNameSnapshot());

        group.setHasNote(
                !normalizedNote.isBlank());

        group.setNote(
                normalizedNote.isBlank()
                        ? null
                        : normalizedNote);

        group.setTotalQuantity(0);

        group.setEarliestCreatedAt(
                item.getCreatedAt());

        return group;
    }

    private String buildKitchenGroupKey(
            OrderItem item)
    {
        String normalizedNote = normalizeKitchenNote(
                item.getNote());

        if (normalizedNote.isBlank())
        {
            return "DISH_"
                    + item.getDish().getId();
        }

        return "ITEM_" + item.getId();
    }

    private String normalizeKitchenNote(
            String note)
    {
        return note == null
                ? ""
                : note.trim();
    }

}
