package vn.edu.fpt.swp391.g6.rimsapi.dto.response.common;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

/**
 * DTO phân trang dùng chung cho mọi API trả về danh sách có phân trang.
 * Không trả trực tiếp {@link Page} của Spring Data ra ngoài vì nó không
 * đảm bảo ổn định khi serialize JSON và làm lộ chi tiết nội bộ (Pageable, Sort...).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T>
{
    private List<T> content;

    private int page; // trang hiện tại (bắt đầu từ 0)

    private int size; // số phần tử mỗi trang

    private long totalElements; // tổng số phần tử (sau khi lọc)

    private int totalPages; // tổng số trang

    private boolean first;

    private boolean last;

    public static <T> PageResponse<T> from(Page<T> page)
    {
        return PageResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .build();
    }
}
