package vn.edu.fpt.swp391.g6.rimsapi.controller;

import java.util.List;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.CancelDishRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.UpdateDishStatusRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.menu.UpdateMenuStatusRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.order.CompleteGroupedOrdersRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.order.UpdateChefInternalNoteRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.kitchen.ChefDashboardResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.kitchen.KitchenOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishDetailResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu.DishListResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.CancelledOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.order.GroupedKitchenOrderResponse;
import vn.edu.fpt.swp391.g6.rimsapi.service.ChefService;

@RestController
@RequestMapping("/rims/chef")
@RequiredArgsConstructor
public class ChefController
{
    private final ChefService chefService;

    @GetMapping("/orders")
    public List<KitchenOrderResponse> getOrders()
    {
        return chefService.getKitchenOrders();
    }

    @GetMapping("/orders/{id}")
    public DishDetailResponse getDishDetail(@PathVariable Long id)
    {
        return chefService.getDishDetail(id);
    }

    @PutMapping("/orders/{id}/status")
    public String updateDishStatus(@PathVariable Long id, @RequestBody UpdateDishStatusRequest request)
    {
        chefService.updateDishStatus(id, request.getStatus());
        return "Cập nhật trạng thái món thành công";
    }
    @GetMapping("/dishes")
    public List<DishListResponse> getDishList()
    {
        return chefService.getDishList();
    }
    @PutMapping("/dishes/{id}/status")
    public String updateMenuStatus(
            @PathVariable Integer id,
            @RequestBody UpdateMenuStatusRequest request)
    {
        chefService.updateMenuStatus(
                id,
                request.getAvailable());

        return "Cập nhật trạng thái thực đơn thành công";
    }
    @GetMapping("/dashboard")
    public ChefDashboardResponse getDashboard()
    {
        return chefService.getDashboard();
    }
    @GetMapping("/orders/completed")
    public List<KitchenOrderResponse> getCompletedOrders()
    {
        return chefService.getCompletedOrders();
    }
    @PutMapping("/orders/{id}/cancel")
    public String cancelDish(
            @PathVariable Long id,
            @Valid @RequestBody CancelDishRequest request)
    {
        chefService.requestCancel(
                id,
                request.getReason());

        return "Hủy món thành công";
    }
    @PutMapping("/orders/{orderItemId}/internal-note")
    public DishDetailResponse updateChefInternalNote(
            @PathVariable Long orderItemId,
            @Valid @RequestBody UpdateChefInternalNoteRequest request)
    {
        return chefService.updateChefInternalNote(
                orderItemId,
                request.getNote());
    }
    @GetMapping("/orders/grouped")
    public List<GroupedKitchenOrderResponse> getGroupedKitchenOrders()
    {
        return chefService.getGroupedKitchenOrders();
    }
    @PutMapping("/orders/grouped/complete")
    public String completeGroupedKitchenOrders(
            @Valid @RequestBody CompleteGroupedOrdersRequest request)
    {
        chefService.completeGroupedKitchenOrders(
                request.getOrderItemIds());

        return "Hoàn thành nhóm món trong bếp thành công";
    }
    @GetMapping("/orders/cancelled")
    public List<CancelledOrderResponse> getCancelledOrders()
    {
        return chefService.getCancelledOrders();
    }
}
