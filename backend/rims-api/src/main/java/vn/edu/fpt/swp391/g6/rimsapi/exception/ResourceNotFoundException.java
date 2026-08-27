package vn.edu.fpt.swp391.g6.rimsapi.exception;

/**
 * Không tìm thấy bản ghi được yêu cầu. GlobalExceptionHandler trả về HTTP 404.
 *
 * <p>Dùng thay cho {@code RuntimeException("Không tìm thấy...")} và
 * {@code jakarta.persistence.EntityNotFoundException} — cả hai trước đây đều rơi
 * xuống handler chung và trả về 500, khiến frontend không phân biệt được
 * "không tìm thấy" với "server lỗi".
 */
public class ResourceNotFoundException extends RuntimeException
{
    public ResourceNotFoundException(String message)
    {
        super(message);
    }

    /** Tiện dụng cho trường hợp phổ biến nhất: tìm theo id. */
    public static ResourceNotFoundException of(String resourceName, Object id)
    {
        return new ResourceNotFoundException("Không tìm thấy " + resourceName + " với ID: " + id);
    }
}
