package vn.edu.fpt.swp391.g6.rimsapi.exception;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import vn.edu.fpt.swp391.g6.rimsapi.dto.response.common.ErrorResponse;

@RestControllerAdvice
public class GlobalExceptionHandler
{

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentialsException(BadCredentialsException ex,
            HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.UNAUTHORIZED.value())
                .error(toVietnameseStatusReason(HttpStatus.UNAUTHORIZED))
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ErrorResponse> handleDisabledException(DisabledException ex, HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.FORBIDDEN.value())
                .error(toVietnameseStatusReason(HttpStatus.FORBIDDEN))
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ErrorResponse> handleInvalidTokenException(InvalidTokenException ex,
            HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.UNAUTHORIZED.value())
                .error(toVietnameseStatusReason(HttpStatus.UNAUTHORIZED))
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(AccessDeniedException ex,
            HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.FORBIDDEN.value())
                .error(toVietnameseStatusReason(HttpStatus.FORBIDDEN))
                .message("Không có quyền truy cập")
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatusException(ResponseStatusException ex,
            HttpServletRequest request)
    {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(status.value())
                .error(toVietnameseStatusReason(status))
                .message(ex.getReason())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, status);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationExceptions(
            MethodArgumentNotValidException ex,
            HttpServletRequest request)
    {

        // Lấy tất cả lỗi validation
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            FieldError fieldError = (FieldError) error;
            String fieldName = fieldError.getField();
            String errorMessage = toVietnameseValidationMessage(fieldError);
            errors.put(fieldName, errorMessage);
        });

        // Lấy message đầu tiên để làm message chính
        String firstErrorMessage = errors.values().stream().findFirst().orElse("Dữ liệu không hợp lệ");

        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error(toVietnameseStatusReason(HttpStatus.BAD_REQUEST))
                .message(firstErrorMessage) // ← Lấy message từ annotation
                .path(request.getRequestURI())
                .details(errors)
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(TableNotAvailableException.class)
    public ResponseEntity<ErrorResponse> handleTableNotAvailableException(TableNotAvailableException ex,
            HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error(toVietnameseStatusReason(HttpStatus.BAD_REQUEST))
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ResponseStatus(HttpStatus.CONFLICT)
    public static class DuplicateResourceException extends RuntimeException
    {
        public DuplicateResourceException(String message)
        {
            super(message);
        }
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class PasswordMismatchException extends RuntimeException
    {
        public PasswordMismatchException(String message)
        {
            super(message);
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException ex,
            HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error(toVietnameseStatusReason(HttpStatus.BAD_REQUEST))
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGlobalException(Exception ex, HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .error(toVietnameseStatusReason(HttpStatus.INTERNAL_SERVER_ERROR))
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public static class ResourceNotFoundException extends RuntimeException
    {
        public ResourceNotFoundException(String message)
        {
            super(message);
        }
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public static class BusinessException extends RuntimeException
    {
        public BusinessException(String message)
        {
            super(message);
        }
    }
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFoundException(ResourceNotFoundException ex,
            HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.NOT_FOUND.value())
                .error(toVietnameseStatusReason(HttpStatus.NOT_FOUND))
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException ex, HttpServletRequest request)
    {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error(toVietnameseStatusReason(HttpStatus.BAD_REQUEST))
                .message(ex.getMessage())
                .path(request.getRequestURI())
                .build();
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
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

        if (defaultMessage != null
                && !defaultMessage.isBlank()
                && containsNonAscii(defaultMessage))
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
