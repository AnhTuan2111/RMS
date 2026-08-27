package vn.edu.fpt.swp391.g6.rimsapi.exception;

/**
 * Thao tác xung đột với trạng thái hiện tại của dữ liệu.
 * GlobalExceptionHandler trả về HTTP 409.
 *
 * <p>Hai nhóm thường gặp:
 * <ul>
 *   <li>Trùng dữ liệu duy nhất: số điện thoại, email, username đã tồn tại.</li>
 *   <li>Sai trạng thái: xoá món đã phát sinh đơn hàng, thanh toán đơn còn món đang nấu.</li>
 * </ul>
 */
public class ConflictException extends RuntimeException
{
    public ConflictException(String message)
    {
        super(message);
    }
}
