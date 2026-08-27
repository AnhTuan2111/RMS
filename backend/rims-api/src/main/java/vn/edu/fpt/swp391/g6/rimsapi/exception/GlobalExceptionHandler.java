package vn.edu.fpt.swp391.g6.rimsapi.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import vn.edu.fpt.swp391.g6.rimsapi.dto.response.common.ErrorResponse;

/**
 * Nơi duy nhất quy đổi exception sang mã HTTP và body lỗi trả về cho frontend.
 *
 * <p>Quy ước ném lỗi trong tầng service:
 *
 * <ul>
 *   <li>404 — {@link ResourceNotFoundException}
 *   <li>400 — {@link BusinessRuleException} (vi phạm quy tắc nghiệp vụ)
 *   <li>409 — {@link ConflictException} (trùng dữ liệu hoặc sai trạng thái)
 *   <li>401 / 403 — để Spring Security tự xử lý
 * </ul>
 *
 * <p>Không dùng {@code RuntimeException} trần: nó rơi xuống handler chung và trả về 500,
 * khiến frontend không phân biệt được lỗi nghiệp vụ với lỗi hệ thống.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler
{

    // ==================== Lỗi nghiệp vụ ====================

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(
            ResourceNotFoundException ex, HttpServletRequest request)
    {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), request);
    }

    /**
     * Hibernate/JPA ném exception này từ getReference() và orElseThrow(). Trước đây không có
     * handler nên nó rơi xuống handler chung và trả về 500 thay vì 404.
     */
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleEntityNotFound(
            EntityNotFoundException ex, HttpServletRequest request)
    {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), request);
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ErrorResponse> handleBusinessRule(
            BusinessRuleException ex, HttpServletRequest request)
    {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(
            ConflictException ex, HttpServletRequest request)
    {
        return build(HttpStatus.CONFLICT, ex.getMessage(), request);
    }

    @ExceptionHandler(TableNotAvailableException.class)
    public ResponseEntity<ErrorResponse> handleTableNotAvailable(
            TableNotAvailableException ex, HttpServletRequest request)
    {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    /**
     * "Sai trạng thái để làm việc này" — ví dụ xoá món đã phát sinh đơn hàng.
     * Về ngữ nghĩa HTTP đây là 409, không phải 400.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(
            IllegalStateException ex, HttpServletRequest request)
    {
        return build(HttpStatus.CONFLICT, ex.getMessage(), request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
            IllegalArgumentException ex, HttpServletRequest request)
    {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    /** Vi phạm ràng buộc unique/foreign key ở tầng DB. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(
            DataIntegrityViolationException ex, HttpServletRequest request)
    {
        // Message gốc của Hibernate lộ tên bảng/cột nên không trả thẳng ra ngoài,
        // nhưng vẫn cần trong log để còn debug được.
        log.warn("Vi phạm ràng buộc dữ liệu tại {}", request.getRequestURI(), ex);

        return build(HttpStatus.CONFLICT, "Dữ liệu đã tồn tại hoặc vi phạm ràng buộc", request);
    }

    // ==================== Xác thực và phân quyền ====================

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(
            BadCredentialsException ex, HttpServletRequest request)
    {
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage(), request);
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ErrorResponse> handleDisabled(
            DisabledException ex, HttpServletRequest request)
    {
        return build(HttpStatus.FORBIDDEN, ex.getMessage(), request);
    }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ErrorResponse> handleInvalidToken(
            InvalidTokenException ex, HttpServletRequest request)
    {
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(
            AccessDeniedException ex, HttpServletRequest request)
    {
        return build(HttpStatus.FORBIDDEN, "Không có quyền truy cập", request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(
            ResponseStatusException ex, HttpServletRequest request)
    {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());

        return build(status, ex.getReason(), request);
    }

    // ==================== Validation ====================

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request)
    {
        // LinkedHashMap để giữ đúng thứ tự field như khai báo trong DTO —
        // frontend lấy message đầu tiên làm thông báo chính.
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        ex.getBindingResult().getAllErrors().forEach(error -> {
            if (error instanceof FieldError fieldError)
            {
                fieldErrors.put(fieldError.getField(), toVietnameseValidationMessage(fieldError));
            }
        });

        String firstMessage = fieldErrors.values().stream().findFirst().orElse("Dữ liệu không hợp lệ");

        ErrorResponse body = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error(toVietnameseStatusReason(HttpStatus.BAD_REQUEST))
                .message(firstMessage)
                .path(request.getRequestURI())
                .details(fieldErrors)
                .build();

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    // ==================== Lỗi ngoài dự kiến ====================

    /** Hệ thống hỏng chứ không phải người dùng gửi sai — vẫn phải log đầy đủ stack trace. */
    @ExceptionHandler(TechnicalException.class)
    public ResponseEntity<ErrorResponse> handleTechnical(
            TechnicalException ex, HttpServletRequest request)
    {
        log.error("Lỗi kỹ thuật tại {} {}", request.getMethod(), request.getRequestURI(), ex);

        return build(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage(), request);
    }

    /**
     * Lưới an toàn cuối cùng. Trước đây không ghi log gì cả, nên mỗi lỗi 500 đều biến mất
     * không để lại dấu vết — đây là chỗ duy nhất còn giữ được stack trace gốc.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request)
    {
        log.error("Lỗi chưa được xử lý tại {} {}", request.getMethod(), request.getRequestURI(), ex);

        // Không trả ex.getMessage() ra ngoài: nó có thể lộ câu SQL, tên bảng hoặc đường dẫn file.
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi hệ thống, vui lòng thử lại sau", request);
    }

    // ==================== Hỗ trợ ====================

    private ResponseEntity<ErrorResponse> build(
            HttpStatus status, String message, HttpServletRequest request)
    {
        ErrorResponse body = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(status.value())
                .error(toVietnameseStatusReason(status))
                .message(message != null && !message.isBlank() ? message : "Có lỗi xảy ra")
                .path(request.getRequestURI())
                .build();

        return new ResponseEntity<>(body, status);
    }

    private String toVietnameseStatusReason(HttpStatus status)
    {
        return switch (status)
        {
            case BAD_REQUEST -> "Yêu cầu không hợp lệ";
            case UNAUTHORIZED -> "Chưa xác thực";
            case FORBIDDEN -> "Không có quyền truy cập";
            case NOT_FOUND -> "Không tìm thấy";
            case CONFLICT -> "Xung đột dữ liệu";
            case INTERNAL_SERVER_ERROR -> "Lỗi hệ thống";
            case SERVICE_UNAVAILABLE -> "Dịch vụ tạm thời không khả dụng";
            default -> "Có lỗi xảy ra";
        };
    }

    private String toVietnameseValidationMessage(FieldError fieldError)
    {
        String defaultMessage = fieldError.getDefaultMessage();

        // Message do lập trình viên tự viết trong annotation đã là tiếng Việt thì giữ nguyên;
        // chỉ dịch những message mặc định tiếng Anh của Bean Validation.
        if (defaultMessage != null && !defaultMessage.isBlank() && containsNonAscii(defaultMessage))
        {
            return defaultMessage;
        }

        String validationCode = fieldError.getCode();

        if (validationCode == null)
        {
            return "Dữ liệu không hợp lệ";
        }

        return switch (validationCode)
        {
            case "NotBlank" -> "Trường này không được để trống";
            case "NotNull" -> "Trường này là bắt buộc";
            case "Email" -> "Email không hợp lệ";
            case "Size" -> "Độ dài dữ liệu không hợp lệ";
            case "Pattern" -> "Định dạng dữ liệu không hợp lệ";
            case "Min" -> "Giá trị nhỏ hơn mức cho phép";
            case "Max" -> "Giá trị lớn hơn mức cho phép";
            case "Positive" -> "Giá trị phải lớn hơn 0";
            case "PositiveOrZero" -> "Giá trị phải lớn hơn hoặc bằng 0";
            case "Future" -> "Thời gian phải ở trong tương lai";
            case "FutureOrPresent" -> "Thời gian không được ở quá khứ";
            case "Past" -> "Thời gian phải ở trong quá khứ";
            case "PastOrPresent" -> "Thời gian không được ở tương lai";
            default -> "Dữ liệu không hợp lệ";
        };
    }

    private boolean containsNonAscii(String value)
    {
        return value.chars().anyMatch(character -> character > 127);
    }
}
