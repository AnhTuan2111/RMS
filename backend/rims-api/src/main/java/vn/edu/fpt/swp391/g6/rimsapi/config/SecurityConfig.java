package vn.edu.fpt.swp391.g6.rimsapi.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter; // Filter mặc định xử lý login form (ta sẽ chèn JWT filter trước nó)
import vn.edu.fpt.swp391.g6.rimsapi.security.JwtAccessDeniedHandler;
import vn.edu.fpt.swp391.g6.rimsapi.security.JwtAuthenticationEntryPoint;
import vn.edu.fpt.swp391.g6.rimsapi.security.JwtAuthenticationFilter; // Dùng để xác thực user cho mỗi request, đọc file này sẽ rõ


@Configuration
@EnableWebSecurity // Kích hoạt toàn bộ cơ chế Spring Security cho ứng dụng web. Khi annotation này được bật, Spring sẽ tạo ra chuỗi Security Filter để xử lý mọi HTTP Request trước khi request đi vào Controller. Nói cách khác, mọi request từ client đều phải đi qua các lớp bảo mật trước rồi mới đến tầng nghiệp vụ.
@EnableMethodSecurity // Hiện chưa cần cái này mấy nhưng tương lai nếu hệ thống mở rộng sẽ cần
@RequiredArgsConstructor
public class SecurityConfig
{
    private final JwtAuthenticationFilter jwtAuthenticationFilter; // Filter kiểm tra + giải mã JWT trong mỗi request
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint; // Xử lý khi request KHÔNG có / token sai -> trả lỗi 401
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler; // Xử lý khi có token nhưng role không đủ quyền -> trả lỗi 403

    @Bean // Bean quan trọng nhất: định nghĩa toàn bộ luật bảo mật cho ứng dụng, Spring sẽ áp dụng cho MỌI request
    public SecurityFilterChain filterChain(HttpSecurity http) // SecurityFilterChain là tập hợp nhiều Security Filter được nối tiếp nhau thành một chuỗi.
    // Mỗi request khi đi vào server sẽ lần lượt đi qua từng filter trong chuỗi này
    // Mỗi filter đảm nhiệm một chức năng riêng như kiểm tra CORS, xử lý CSRF, xác thực JWT, phân quyền, quản lý Session...
    // Chỉ khi tất cả các filter cho phép thì request mới được chuyển sang Controller
    {
        http
                // Tắt CSRF (Cross-Site Request Forgery) protection vì đây là REST API dùng JWT (stateless, không dùng cookie/session) nên không cần CSRF token như web truyền thống
                .csrf(AbstractHttpConfigurer::disable)

                // Bật CORS và dùng cấu hình mặc định của Spring, thực chất Spring sẽ tự tìm Bean "CorsConfigurationSource" để áp dụng
                .cors(Customizer.withDefaults())

                // Quy định cách quản lý session: STATELESS nghĩa là server KHÔNG lưu session nào cho user
                // Mỗi request gửi lên đều phải tự mang JWT. Spring sẽ xác thực lại token từ đầu ở từng request
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // Khai báo cách xử lý lỗi liên quan xác thực/phân quyền, thay vì dùng trang lỗi mặc định của Spring
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                        .accessDeniedHandler(jwtAccessDeniedHandler))

                // Khai báo luật phân quyền theo từng nhóm URL, xét THEO THỨ TỰ TỪ TRÊN XUỐNG
                // Ngay khi một request khớp với một rule thì Spring sẽ dừng kiểm tra và áp dụng rule đó
                .authorizeHttpRequests(auth -> auth

                        // vì VNPay server gọi thẳng vào, không thể đính kèm JWT của user được
                        .requestMatchers("/rims/cashier/payments/vnpay-callback").permitAll()

                        // Các endpoint thuộc luồng xác thực (đăng ký, đăng nhập, đăng xuất, refresh token, quên/đặt lại mật khẩu)
                        .requestMatchers(
                                "/rims/auth/register",
                                "/rims/auth/login",
                                "/rims/auth/logout",
                                "/rims/auth/refresh",
                                "/rims/auth/forgot-password",
                                "/rims/auth/reset-password").permitAll() // Đều KHÔNG cần token vì user chưa đăng nhập lúc gọi các API này

                        // Kết nối WebSocket có quá trình bắt tay (Handshake) riêng
                        // Sau khi kết nối được thiết lập, việc xác thực người dùng được thực hiện ở tầng STOMP thông qua interceptor StompAuthChannelInterceptor, thay vì Security Filter của HTTP.
                        .requestMatchers("/ws-rims/**").permitAll()

                        // Nhóm endpoint công khai (vd xem menu công khai, thông tin nhà hàng...) không cần đăng nhập
                        .requestMatchers("/rims/public/**").permitAll()

                        // Từ đây là các rule phân quyền theo ROLE — user phải có JWT hợp lệ VÀ đúng role tương ứng
                        .requestMatchers("/rims/admin/**").hasRole("ADMIN")
                        .requestMatchers("/rims/chef/**").hasRole("CHEF")
                        .requestMatchers("/rims/waiter/**").hasRole("WAITER")
                        .requestMatchers("/rims/cashier/**").hasRole("CASHIER")
                        .requestMatchers("/rims/customer/**").hasRole("CUSTOMER")

                        // Mọi request không khớp bất kỳ rule nào phía trên đều phải đăng nhập.
                        .anyRequest().authenticated()
                )

                // Chèn "jwtAuthenticationFilter" chạy TRƯỚC filter mặc định "UsernamePasswordAuthenticationFilter" của Spring Security
                // Điều này có nghĩa là ngay khi request đi vào hệ thống, JWT Filter sẽ chạy trước để:
                // Đọc Authorization Header -> Lấy JWT -> Kiểm tra chữ ký -> Kiểm tra thời gian hết hạn ->Trích xuất thông tin người dùng -> Tạo đối tượng Authentication -> Đưa vào SecurityContextHolder
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
        // Tất cả các thiết lập như CSRF, CORS, Session Management, Exception Handling, Authorization Rules và JWT Filter được tổng hợp thành một đối tượng SecurityFilterChain
        // Spring lưu đối tượng này vào ApplicationContext và sử dụng nó để xử lý mọi HTTP Request đi vào ứng dụng.
        // Có thể xem SecurityFilterChain là cổng bảo vệ của toàn bộ hệ thống: mỗi request đều phải đi qua chuỗi filter này trước khi được phép đến Controller và các tầng nghiệp vụ phía sau
    }
}
