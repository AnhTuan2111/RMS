package vn.edu.fpt.swp391.g6.rimsapi.dto.response.menu;

import java.util.List;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MenuDashboardResponse
{
    // 4 thẻ chỉ số trên cùng
    private long totalDishes;
    private long totalCategories;
    private long totalPausedDishes;
    private long totalHiddenDishes;

    // Khối ở giữa: 4 món mới thêm
    private List<DishSummaryResponse> latestDishes;

    // Khối bên trái: Thống kê danh mục (Tên, Trạng thái, Số lượng món)
    private List<CategoryStatResponse> categoryStats;

    @Data
    @Builder
    public static class DishSummaryResponse
    {
        private Integer id;
        private String name;
        private String categoryName;
        private Double price;
        private String imageUrl;
        private String status;
    }

    @Data
    @Builder
    public static class CategoryStatResponse
    {
        private String categoryName;
        private String status;
        private long dishCount;
    }
}
