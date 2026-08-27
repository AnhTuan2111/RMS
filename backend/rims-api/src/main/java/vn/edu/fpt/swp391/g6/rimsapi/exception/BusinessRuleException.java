package vn.edu.fpt.swp391.g6.rimsapi.exception;

/**
 * Yêu cầu hợp lệ về mặt cú pháp nhưng vi phạm quy tắc nghiệp vụ.
 * GlobalExceptionHandler trả về HTTP 400.
 *
 * <p>Ví dụ: đặt bàn ngoài giờ mở cửa, dùng nhiều điểm thưởng hơn số điểm đang có.
 *
 * <p>Phân biệt với {@link ConflictException}: dùng lớp này khi dữ liệu gửi lên sai;
 * dùng ConflictException khi dữ liệu đúng nhưng trạng thái hiện tại của hệ thống
 * không cho phép thực hiện.
 */
public class BusinessRuleException extends RuntimeException
{
    public BusinessRuleException(String message)
    {
        super(message);
    }
}
