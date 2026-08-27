package vn.edu.fpt.swp391.g6.rimsapi.exception;

/**
 * Hệ thống hỏng chứ không phải người dùng gửi sai. GlobalExceptionHandler trả về HTTP 500
 * và ghi log kèm stack trace.
 *
 * <p>Ví dụ: ký JWT thất bại, băm chữ ký VNPay lỗi, không dựng được file PDF.
 *
 * <p>Luôn truyền exception gốc vào tham số {@code cause} — nếu không, nguyên nhân thật
 * sẽ mất và trong log chỉ còn lại một dòng thông báo vô dụng.
 */
public class TechnicalException extends RuntimeException
{
    public TechnicalException(String message, Throwable cause)
    {
        super(message, cause);
    }
}
