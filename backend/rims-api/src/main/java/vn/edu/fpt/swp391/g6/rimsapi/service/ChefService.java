package vn.edu.fpt.swp391.g6.rimsapi.service;

import java.util.List;

import vn.edu.fpt.swp391.g6.rimsapi.dto.response.kitchen.ChefDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.kitchen.KitchenOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishListResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.CancelledOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.GroupedKitchenOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderItemStatus;

public interface ChefService
{

    List<KitchenOrderResponse> getKitchenOrders();

    DishDetailResponse getDishDetail(Long orderItemId);

    void updateDishStatus(Long orderItemId, OrderItemStatus status);

    List<DishListResponse> getDishList();

    void updateMenuStatus(
            Integer dishId,
            Boolean available);

    ChefDashboardResponse getDashboard();

    void requestCancel(Long orderItemId, String reason);

    List<KitchenOrderResponse> getCompletedOrders();
    DishDetailResponse updateChefInternalNote(
            Long orderItemId,
            String note);
    List<GroupedKitchenOrderResponse> getGroupedKitchenOrders();

    void completeGroupedKitchenOrders(
            List<Long> orderItemIds);
    List<CancelledOrderResponse> getCancelledOrders();

}
