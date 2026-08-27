package vn.edu.fpt.swp391.g6.rimsapi.dto.response.order;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GroupedKitchenOrderResponse
{

    private String groupKey;

    private Integer dishId;

    private String dishName;

    private String note;

    private boolean hasNote;

    private Integer totalQuantity = 0;

    private LocalDateTime earliestCreatedAt;

    private List<GroupedKitchenItemResponse> items = new ArrayList<>();
}
