package vn.edu.fpt.swp391.g6.rimsapi.config;

import org.springframework.context.annotation.Bean; // đánh dấu 1 method trả về object sẽ được spring quản lý (Bean)
import org.springframework.context.annotation.Configuration; // đánh dấu class này là 1 lớp cấu hình của spring
import org.springframework.web.cors.CorsConfiguration; // Class chứa các thiết lập CORS (origin, method, header...)
import org.springframework.web.cors.CorsConfigurationSource; // Interface đại diện "nguồn" cấu hình CORS mà Spring Security sẽ đọc
import org.springframework.web.cors.UrlBasedCorsConfigurationSource; // Implementation cho phép gắn cấu hình CORS theo từng pattern URL

import java.util.List;


// CorsConfig là một lớp cấu hình của Spring dùng để khai báo chính sách Cross-Origin Resource Sharing (CORS), cho phép frontend và backend có thể giao tiếp với nhau khi chúng chạy trên các origin khác nhau
// Dòng @Configuration đánh dấu đây là một lớp cấu hình, nghĩa là khi ứng dụng Spring Boot khởi động, cơ chế component scanning sẽ phát hiện lớp này, khởi tạo nó và đọc tất cả các phương thức được đánh dấu @Bean
// Những đối tượng được tạo ra từ các phương thức này sẽ được lưu vào ApplicationContext, tức là vùng chứa trung tâm quản lý toàn bộ Bean của Spring
// Điều này giúp các thành phần khác của framework, đặc biệt là Spring Security, có thể tự động lấy và sử dụng cấu hình mà không cần lập trình viên phải khởi tạo thủ công.
@Configuration
public class CorsConfig // Cross-origin resource sharing
{

    // Annotation này thông báo cho Spring rằng giá trị trả về của phương thức không phải chỉ là một đối tượng Java thông thường mà sẽ trở thành một Bean được quản lý trong IoC Container.
    // Khi ứng dụng khởi động, Spring chỉ gọi phương thức này một lần (đối với Bean có phạm vi Singleton mặc định), lưu kết quả vào ApplicationContext và sau đó mọi thành phần cần đến CorsConfigurationSource đều sẽ sử dụng cùng một instance này
    // Trong trường hợp của Spring Security, khi tính năng CORS được bật thông qua http.cors(...), framework sẽ tự động tìm Bean có kiểu CorsConfigurationSource, đọc toàn bộ cấu hình bên trong và áp dụng vào quá trình xử lý request trước khi request được chuyển đến Controller.
    @Bean
    public CorsConfigurationSource corsConfigurationSource()
    {
        // Tạo ra một đối tượng rỗng dùng để chứa toàn bộ các quy tắc CORS.
        // Có thể hiểu đây là nơi tập hợp tất cả các chính sách mà server sẽ áp dụng để quyết định xem một request đến từ trình duyệt có được phép truy cập tài nguyên hay không.
        // Ban đầu đối tượng này chưa chứa bất kỳ quy tắc nào, vì vậy các phương thức phía sau sẽ lần lượt bổ sung các điều kiện như origin được phép, phương thức HTTP được phép, header được phép và việc có cho phép gửi thông tin xác thực hay không.
        CorsConfiguration configuration = new CorsConfiguration();

        // khai khai báo danh sách các Origin được phép truy cập API. Trong CORS, Origin không chỉ là tên miền mà còn bao gồm cả giao thức (HTTP hoặc HTTPS) và cổng (port)
        configuration.setAllowedOrigins(List.of("http://localhost:5173"));

        // Quy định những phương thức HTTP nào được phép sử dụng khi frontend gửi request tới server.
        // Mỗi phương thức HTTP đại diện cho một mục đích khác nhau: GET dùng để lấy dữ liệu, POST dùng để tạo mới tài nguyên, PUT dùng để cập nhật toàn bộ tài nguyên, PATCH dùng để cập nhật một phần dữ liệu, còn DELETE dùng để xóa dữ liệu.
        // Đặc biệt, OPTIONS được khai báo vì đây là phương thức mà trình duyệt tự động sử dụng để gửi Preflight Request.
        // Khi frontend chuẩn bị gửi một request không thuộc loại "simple request", chẳng hạn như request có header Authorization, sử dụng Content-Type: application/json, hoặc dùng các phương thức như PUT, DELETE và PATCH, trình duyệt sẽ không gửi request chính ngay lập tức.
        // Thay vào đó, nó sẽ gửi một request OPTIONS trước để hỏi server xem request sắp gửi có được phép hay không.
        // Nếu server phản hồi bằng các header CORS phù hợp thì request chính mới được gửi tiếp.
        // Nếu OPTIONS không được cho phép hoặc không có phản hồi hợp lệ thì request chính sẽ bị trình duyệt hủy ngay tại phía client và backend sẽ không bao giờ nhận được.
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));

        // Cho phép tất cả các loại header trong request (vd: Authorization, Content-Type,...)
        // Dấu "*" nghĩa là không giới hạn header nào
        configuration.setAllowedHeaders(List.of("*"));

        // Cho phép trình duyệt gửi kèm thông tin xác thực (cookie, header Authorization, session...)
        configuration.setAllowCredentials(true);

        // Tạo 1 "nguồn" cấu hình CORS dựa theo URL pattern, cho phép áp cấu hình khác nhau cho từng path nếu cần
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        // Đăng ký đối tượng configuration vừa tạo cho tất cả các endpoint khớp với pattern /rims/**
        source.registerCorsConfiguration("/rims/**", configuration);

        // Do phương thức được đánh dấu bằng @Bean, Spring sẽ lưu đối tượng này vào ApplicationContext
        return source; // Trả về nguồn cấu hình này, Spring Security sẽ dùng nó khi xử lý mọi request
    }

}
