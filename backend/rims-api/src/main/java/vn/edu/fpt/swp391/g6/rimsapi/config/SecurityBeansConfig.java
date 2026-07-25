package vn.edu.fpt.swp391.g6.rimsapi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder; // Interface chuẩn của Spring Security cho việc mã hoá/so khớp mật khẩu


@Configuration
public class SecurityBeansConfig
{
    @Bean // Đăng ký bean PasswordEncoder dùng chung cho toàn bộ ứng dụng
    public PasswordEncoder passwordEncoder()
    {
        // Trả về instance BCryptPasswordEncoder — dùng để:
        // 1. Mã hoá mật khẩu trước khi lưu vào DB lúc đăng ký (encode)
        // 2. So sánh mật khẩu người dùng nhập lúc login với hash đã lưu (matches)
        // BCrypt tự sinh "salt" ngẫu nhiên cho mỗi lần hash nên cùng 1 mật khẩu sẽ ra hash khác nhau mỗi lần
        return new BCryptPasswordEncoder();
    }
}

// Chuyện bên lề :
// Việc sử dụng Salt giúp BCrypt chống lại nhiều hình thức tấn công phổ biến, đặc biệt là Rainbow Table Attack.
// Rainbow Table là một cơ sở dữ liệu khổng lồ chứa sẵn hàng triệu hoặc hàng tỷ cặp giá trị giữa mật khẩu và hash tương ứng.
// Nếu hệ thống chỉ sử dụng các thuật toán như MD5 hoặc SHA-1 mà không thêm Salt, hacker chỉ cần tra cứu hash trong Rainbow Table là có thể biết ngay mật khẩu gốc mà không cần brute-force.
// Tuy nhiên, khi mỗi mật khẩu đều được kết hợp với một Salt ngẫu nhiên khác nhau, hash sinh ra sẽ hoàn toàn khác với các giá trị có trong Rainbow Table, khiến các bảng tra cứu này gần như vô dụng.
// Đây là lý do BCrypt được xem là có khả năng chống Rainbow Table rất hiệu quả.