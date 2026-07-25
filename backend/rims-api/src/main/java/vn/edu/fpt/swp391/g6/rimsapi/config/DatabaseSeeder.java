package vn.edu.fpt.swp391.g6.rimsapi.config;

import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import vn.edu.fpt.swp391.g6.rimsapi.entity.*;
import vn.edu.fpt.swp391.g6.rimsapi.enums.*;
import vn.edu.fpt.swp391.g6.rimsapi.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Random;


@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner
{

    private static final String DEFAULT_PASSWORD = "123456";

    // Số lượng order lịch sử cần seed
    private static final int HISTORICAL_ORDER_COUNT = 3000;

    // Seed cố định để dữ liệu sinh ra ổn định giữa các lần chạy lại (dễ debug/test)
    private static final Random RNG = new Random(100);

    // Mốc bắt đầu rải dữ liệu lịch sử
    private static final LocalDateTime HISTORY_START = LocalDateTime.of(2025, 1, 1, 8, 0);

    /**
     * Table layout: each entry represents a group {count, capacity}.
     * T01–T04  → 4 tables × 2 seats
     * T05–T10  → 6 tables × 4 seats
     * T11–T12  → 2 tables × 8 seats
     */
    private static final int[][] TABLE_GROUPS = {
            {4, 2},
            {6, 4},
            {2, 8}
    };

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final DishRepository dishRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CategoryRepository categoryRepository;
    private final RestaurantTableRepository tableRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final ReservationRepository reservationRepository;

    // Dùng để ghi đè các cột do @CreatedDate/@LastModifiedDate tự set = now() khi save(),
    // bằng cách UPDATE thẳng qua SQL thuần (không đi qua vòng đời entity nên auditing
    // không can thiệp lại lần nữa). Không cần sửa entity.
    private final JdbcTemplate jdbcTemplate;


    @Override
    public void run(String @NonNull ... args)
    {
        seedUsers();
        seedTables();
        seedCategoriesAndDishes();
        seedHistoricalOrders();
        seedLiveServingOrders();
        seedReservations();
        backfillInvoiceRestaurantRevenueAmount();
        System.out.println("Database seeder done!");
    }

    // ══════════════════════════════════════════════════════════════════
    // Users – 8 tài khoản: 1 admin, 1 chef, 1 waiter, 1 cashier, 6 customer
    // ══════════════════════════════════════════════════════════════════
    private void seedUsers()
    {
        if (userRepository.count() > 0) return;

        record UserDef(String username, String fullName, String email, String phone, RoleType role, int rewardPoints)
        {
        }

        List<UserDef> defs = List.of(
                new UserDef("admin", "Nguyễn Thành Vinh", "admin@rims.local", "0900000001", RoleType.ADMIN, 0),
                new UserDef("chef", "Phạm Minh Nghĩa", "chef@rims.local", "0900000002", RoleType.CHEF, 0),
                new UserDef("waiter", "Nguyễn Anh Tuấn", "waiter@rims.local", "0900000003", RoleType.WAITER, 0),
                new UserDef("cashier", "Phạm Tuấn Anh", "cashier@rims.local", "0900000004", RoleType.CASHIER, 0),
                new UserDef("customer1", "Nguyễn Thị Thu Hiền", "customer1@rims.local", "0900000005", RoleType.CUSTOMER, 0),
                new UserDef("customer2", "Nguyễn Xuân Bắc", "customer2@rims.local", "0900000006", RoleType.CUSTOMER, 0),
                new UserDef("customer3", "Trần Văn Long", "customer3@rims.local", "0900000007", RoleType.CUSTOMER, 100),
                new UserDef("customer4", "Lê Thị Mai Anh", "customer4@rims.local", "0900000008", RoleType.CUSTOMER, 500),
                new UserDef("customer5", "Đỗ Quang Huy", "customer5@rims.local", "0900000009", RoleType.CUSTOMER, 1500),
                new UserDef("customer6", "Vũ Thị Ngọc Ánh", "customer6@rims.local", "0900000010", RoleType.CUSTOMER, 3000)
        );

        List<User> users = defs.stream()
                .map(d -> buildUser(d.username(), d.fullName(), d.email(), d.phone(), d.role(), d.rewardPoints()))
                .toList();

        userRepository.saveAll(users);
    }

    private User buildUser(String username, String fullName, String email, String phone, RoleType role, int rewardPoints)
    {
        User user = new User();
        user.setUsername(username);
        user.setFullName(fullName);
        user.setEmail(email);
        user.setPhone(phone);
        user.setRole(role);
        user.setPasswordHash(passwordEncoder.encode(DEFAULT_PASSWORD));
        user.setActive(true);
        user.setRewardPoints(rewardPoints);
        return user;
    }

    // ══════════════════════════════════════════════════════════════════
    // Restaurant Tables – giữ nguyên số lượng bàn + sức chứa như bản mẫu
    //   7 SERVING  : T01, T02, T03, T05, T06, T07, T08
    //   3 AVAILABLE: T09, T11, T12
    //   2 RESERVED : T04, T10
    // ══════════════════════════════════════════════════════════════════
    private void seedTables()
    {
        if (tableRepository.count() > 0) return;

        List<RestaurantTable> tables = new ArrayList<>();
        int tableNumber = 1;
        for (int[] group : TABLE_GROUPS)
        {
            int count = group[0];
            int capacity = group[1];
            for (int i = 0; i < count; i++, tableNumber++)
            {
                tables.add(buildTable(String.format("T%02d", tableNumber), capacity,
                        resolveTableStatus(tableNumber)));
            }
        }
        tableRepository.saveAll(tables);
    }

    private TableStatus resolveTableStatus(int num)
    {
        return switch (num)
        {
            case 4, 10 -> TableStatus.RESERVED;
            case 9, 11, 12 -> TableStatus.AVAILABLE;
            default -> TableStatus.SERVING;
        };
    }

    private RestaurantTable buildTable(String tableNumber, int capacity, TableStatus status)
    {
        RestaurantTable table = new RestaurantTable();
        table.setTableNumber(tableNumber);
        table.setCapacity(capacity);
        table.setStatus(status);
        return table;
    }


    // ══════════════════════════════════════════════════════════════════
    // Categories & Dishes – 12 category, 125 món theo phong cách Trung Hoa
    //   Lẩu (10) · Dimsum (10) · Tứ Xuyên (10) · Quảng Đông (10) ·
    //   Mì & Sợi (10) · Cơm & Cháo (10) · Nướng & Xiên (10) · Khai vị (10) ·
    //   Hải sản (10) · Tráng miệng (10) · Món Việt (10) · Đồ uống (15)
    // ══════════════════════════════════════════════════════════════════
    private void seedCategoriesAndDishes()
    {
        if (dishRepository.count() > 0) return;

        Category hotpot = buildCategory("Lẩu", "Các loại lẩu đặc trưng vùng miền Trung Hoa, phục vụ theo nồi 4 người");
        Category dimsum = buildCategory("Dimsum / Điểm tâm", "Các món điểm tâm kiểu Quảng Đông: há cảo, xíu mại, bánh bao...");
        Category sichuan = buildCategory("Món Tứ Xuyên", "Các món chính đặc trưng ẩm thực Tứ Xuyên: cay, tê, đậm vị");
        Category canton = buildCategory("Món Quảng Đông", "Các món chính đặc trưng ẩm thực Quảng Đông: thanh nhẹ, ít dầu mỡ");
        Category noodle = buildCategory("Mì & Sợi", "Các món mì, miến đặc trưng vùng miền Trung Hoa");
        Category riceCongee = buildCategory("Cơm & Cháo", "Các món cơm và cháo đặc trưng ẩm thực Trung Hoa");
        Category grill = buildCategory("Nướng & Xiên Trung Hoa", "Các món nướng và xiên đặc trưng ẩm thực Trung Hoa");
        Category coldApp = buildCategory("Khai vị / Món nguội", "Các món khai vị và món nguội ăn kèm kiểu Trung Hoa");
        Category seafood = buildCategory("Hải sản Trung Hoa", "Các món hải sản cao cấp đặc trưng ẩm thực Trung Hoa");
        Category dessertCn = buildCategory("Tráng miệng Trung Hoa", "Các món tráng miệng ngọt đặc trưng ẩm thực Trung Hoa");
        Category vietnamese = buildCategory("Món Việt", "Các món ăn đặc trưng ẩm thực Việt Nam");
        Category drink = buildCategory("Đồ uống", "Đồ uống đa dạng: trà Trung Hoa, nước ngọt, nước ép và các loại giải khát khác");

        categoryRepository.saveAll(List.of(hotpot, dimsum, sichuan, canton, noodle, riceCongee,
                grill, coldApp, seafood, dessertCn, vietnamese, drink));

        List<Dish> dishes = new ArrayList<>();

        // 10 Lẩu (giá tính theo nồi, phục vụ 4 người)
        dishes.add(buildDish("Lẩu Tứ Xuyên cay tê (Mala) - nồi 4 người", "Nồi lẩu Tứ Xuyên vị mala cay tê đặc trưng, sả ớt và hoa tiêu, phục vụ 2-4 người", 399_000, "lau-tu-xuyen-mala.jpg", hotpot));
        dishes.add(buildDish("Lẩu Trùng Khánh dầu ớt - nồi 4 người", "Nồi lẩu Trùng Khánh đậm vị dầu ớt cay nồng, đặc sản vùng Tây Nam Trung Quốc, phục vụ 2-4 người", 399_000, "lau-trung-khanh.jpg", hotpot));
        dishes.add(buildDish("Lẩu Vân Nam nấm rừng - nồi 4 người", "Nồi lẩu nước dùng thanh ngọt từ các loại nấm rừng Vân Nam, phục vụ 2-4 người", 359_000, "lau-van-nam-nam-rung.jpg", hotpot));
        dishes.add(buildDish("Lẩu Vũ Hán sườn bò - nồi 4 người", "Nồi lẩu sườn bò hầm kiểu Vũ Hán, nước dùng đậm đà, phục vụ 2-4 người", 459_000, "lau-vu-han-suon-bo.jpg", hotpot));
        dishes.add(buildDish("Lẩu Quảng Đông hải sản - nồi 4 người", "Nồi lẩu hải sản tươi kiểu Quảng Đông, nước dùng thanh ngọt tự nhiên, phục vụ 2-4 người", 599_000, "lau-quang-dong-hai-san.jpg", hotpot));
        dishes.add(buildDish("Lẩu Bắc Kinh cừu nhúng - nồi 4 người", "Nồi lẩu đồng cừu nhúng kiểu Bắc Kinh truyền thống, chấm sốt mè, phục vụ 2-4 người", 459_000, "lau-bac-kinh-cuu-nhung.jpg", hotpot));
        dishes.add(buildDish("Lẩu Quý Châu chua cay - nồi 4 người", "Nồi lẩu chua cay đặc trưng Quý Châu, cà chua lên men và ớt tươi, phục vụ 2-4 người", 359_000, "lau-quy-chau-chua-cay.jpg", hotpot));
        dishes.add(buildDish("Lẩu Hồ Nam cá cay - nồi 4 người", "Nồi lẩu cá cay kiểu Hồ Nam, vị cay nồng đặc trưng miền Trung Trung Quốc, phục vụ 2-4 người", 399_000, "lau-ho-nam-ca-cay.jpg", hotpot));
        dishes.add(buildDish("Lẩu Thượng Hải gà ác thuốc bắc - nồi 4 người", "Nồi lẩu gà ác tần thuốc bắc kiểu Thượng Hải, bồi bổ sức khoẻ, phục vụ 2-4 người", 429_000, "lau-thuong-hai-ga-ac.jpg", hotpot));
        dishes.add(buildDish("Lẩu Sa Tế Triều Châu bò - nồi 4 người", "Nồi lẩu sa tế bò kiểu Triều Châu, nước dùng sa tế thơm béo, phục vụ 2-4 người", 429_000, "lau-satay-trieu-chau-bo.jpg", hotpot));

        // 10 Dimsum
        dishes.add(buildDish("Há cảo tôm", "Há cảo tôm hấp kiểu Quảng Đông, vỏ bột mỏng trong suốt, nhân tôm tươi", 65_000, "ha-cao-tom.jpg", dimsum));
        dishes.add(buildDish("Xíu mại tôm thịt", "Xíu mại tôm thịt hấp truyền thống, topping trứng cá cam", 59_000, "xiu-mai-tom-thit.jpg", dimsum));
        dishes.add(buildDish("Bánh bao xá xíu nướng", "Bánh bao nướng nhân xá xíu, vỏ ngoài giòn ngọt kiểu Hồng Kông", 55_000, "banh-bao-xa-xiu-nuong.jpg", dimsum));
        dishes.add(buildDish("Bánh cuốn tôm Quảng Đông", "Bánh cuốn gạo mềm mịn nhân tôm, chan nước tương ngọt", 65_000, "banh-cuon-tom-quang-dong.jpg", dimsum));
        dishes.add(buildDish("Chân gà sốt đậu đen (Phượng trảo)", "Chân gà hấp sốt đậu đen lên men, món điểm tâm đặc trưng Quảng Đông", 55_000, "chan-ga-sot-dau-den.jpg", dimsum));
        dishes.add(buildDish("Bánh củ cải chiên", "Bánh củ cải hấp rồi áp chảo giòn, ăn kèm tương ớt", 49_000, "banh-cu-cai-chien.jpg", dimsum));
        dishes.add(buildDish("Bánh xếp hẹ tôm hấp", "Bánh xếp nhân hẹ và tôm hấp, vỏ bột gạo mỏng", 55_000, "banh-xep-he-tom.jpg", dimsum));
        dishes.add(buildDish("Sườn heo hấp đậu đen", "Sườn heo non hấp sốt đậu đen tỏi ớt, mềm và đậm đà", 69_000, "suon-heo-hap-dau-den.jpg", dimsum));
        dishes.add(buildDish("Bánh bao kim sa trứng muối", "Bánh bao nhân kem trứng muối chảy, ngọt béo đặc trưng", 59_000, "banh-bao-kim-sa.jpg", dimsum));
        dishes.add(buildDish("Chả tôm cuốn rong biển chiên", "Chả tôm cuộn rong biển chiên giòn, món điểm tâm phổ biến", 65_000, "cha-tom-cuon-rong-bien.jpg", dimsum));

        // 10 Món Tứ Xuyên
        dishes.add(buildDish("Mapo đậu hũ Tứ Xuyên", "Đậu hũ non sốt cay tê đặc trưng Tứ Xuyên, thịt băm và hoa tiêu", 79_000, "mapo-dau-hu.jpg", sichuan));
        dishes.add(buildDish("Gà cung bảo Tứ Xuyên", "Gà xào đậu phộng, ớt khô kiểu Tứ Xuyên, vị chua cay ngọt hài hoà", 109_000, "ga-cung-bao.jpg", sichuan));
        dishes.add(buildDish("Cá thuỷ chử Tứ Xuyên", "Cá lát nấu ngập dầu ớt cay nồng, đặc sản trứ danh Tứ Xuyên", 189_000, "ca-thuy-chu.jpg", sichuan));
        dishes.add(buildDish("Bò xào sa tế Tứ Xuyên", "Thịt bò xào khô sốt sa tế cay, đậm vị đặc trưng miền Tây Nam", 149_000, "bo-xao-sate-tu-xuyen.jpg", sichuan));
        dishes.add(buildDish("Hồi oa nhục Tứ Xuyên", "Thịt heo ba chỉ luộc rồi xào lại với tỏi tây, món kinh điển Tứ Xuyên", 129_000, "heo-quay-tu-xuyen-hoi-oa-nhuc.jpg", sichuan));
        dishes.add(buildDish("Đậu hũ thối chiên Tứ Xuyên", "Đậu hũ lên men chiên giòn, chấm tương ớt cay, món đường phố đặc trưng", 89_000, "dau-hu-thoi-tu-xuyen.jpg", sichuan));
        dishes.add(buildDish("Tôm sốt cay Tứ Xuyên", "Tôm sú sốt cay kiểu Tứ Xuyên, đậm đà và thơm nồng hoa tiêu", 169_000, "tom-sot-tu-xuyen.jpg", sichuan));
        dishes.add(buildDish("Ếch xào cay Tứ Xuyên", "Đùi ếch xào cay tê kiểu Tứ Xuyên, thịt dai ngọt tự nhiên", 159_000, "ech-xao-cay-tu-xuyen.jpg", sichuan));
        dishes.add(buildDish("Mì đạm đạm Tứ Xuyên (Dan Dan)", "Mì trộn sốt vừng, thịt băm cay và hoa tiêu, món ăn đường phố nổi tiếng", 99_000, "mi-dam-dam-tu-xuyen.jpg", sichuan));
        dishes.add(buildDish("Gà xé nước bọt Tứ Xuyên (Khẩu Thuỷ Kê)", "Gà luộc xé nhỏ trộn sốt cay tê đặc trưng, ăn lạnh khai vị", 129_000, "ga-xe-nuoc-bot-tu-xuyen.jpg", sichuan));

        // 10 Món Quảng Đông
        dishes.add(buildDish("Vịt quay Bắc Kinh phong cách Quảng Đông - phần nhỏ", "Vịt quay da giòn thái lát, cuốn bánh tráng mỏng và sốt hoisin", 249_000, "vit-quay-bac-kinh-mini.jpg", canton));
        dishes.add(buildDish("Gà quay Quảng Đông", "Gà quay nguyên con da giòn vàng ươm, thịt mềm ngọt đậm đà", 199_000, "ga-quay-quang-dong.jpg", canton));
        dishes.add(buildDish("Sườn xá xíu nướng", "Sườn heo ướp xá xíu nướng mật ong, ngọt mặn hài hoà kiểu Quảng Đông", 139_000, "suon-xa-xiu-nuong.jpg", canton));
        dishes.add(buildDish("Cá hấp Hồng Kông", "Cá hấp xì dầu kiểu Hồng Kông, hành gừng thơm, vị thanh nhẹ tự nhiên", 189_000, "ca-hap-hong-kong.jpg", canton));
        dishes.add(buildDish("Heo quay giòn bì Quảng Đông", "Thịt heo quay giòn bì đặc trưng Quảng Đông, chấm tương ớt", 149_000, "heo-quay-gion-bi.jpg", canton));
        dishes.add(buildDish("Gà hấp hành gừng Quảng Đông", "Gà hấp nguyên con chấm mỡ hành gừng, món thanh đạm truyền thống", 159_000, "ga-hap-hanh-gung.jpg", canton));
        dishes.add(buildDish("Bò lúc lắc Quảng Đông", "Thịt bò xào lúc lắc sốt tiêu đen kiểu Quảng Đông, mềm và đậm vị", 149_000, "bo-luc-lac-quang-dong.jpg", canton));
        dishes.add(buildDish("Ngỗng quay Quảng Đông", "Ngỗng quay da giòn thơm, đặc sản trứ danh vùng Quảng Đông", 229_000, "ngan-quay-quang-dong.jpg", canton));
        dishes.add(buildDish("Tôm hấp tỏi Quảng Đông", "Tôm sú hấp tỏi phi thơm, giữ vị ngọt tự nhiên của tôm", 179_000, "tom-hap-toi-quang-dong.jpg", canton));
        dishes.add(buildDish("Đậu hũ non sốt hải sản Quảng Đông", "Đậu hũ non sốt hải sản kiểu Quảng Đông, béo mịn và thanh nhẹ", 119_000, "dau-hu-non-sot-hai-san.jpg", canton));

        // 10 Mì & Sợi
        dishes.add(buildDish("Mì kéo Lan Châu bò", "Mì kéo tay Lan Châu nước dùng bò trong, thơm hồi quế đặc trưng Cam Túc", 99_000, "mi-keo-lan-chau-bo.jpg", noodle));
        dishes.add(buildDish("Mì tương đen Bắc Kinh (Zhajiangmian)", "Mì trộn tương đậu nành lên men, thịt băm xào kiểu Bắc Kinh truyền thống", 89_000, "mi-tuong-den-bac-kinh.jpg", noodle));
        dishes.add(buildDish("Mì bò cay Tứ Xuyên", "Mì nước dùng bò cay tê đậm vị Tứ Xuyên, thịt bò hầm mềm", 109_000, "mi-bo-cay-tu-xuyen.jpg", noodle));
        dishes.add(buildDish("Mì vằn thắn Quảng Đông", "Mì sợi trứng dai cùng vằn thắn tôm thịt, nước dùng xương ngọt thanh", 89_000, "mi-van-than-quang-dong.jpg", noodle));
        dishes.add(buildDish("Mì xào giòn Quảng Đông", "Mì trứng chiên giòn phủ sốt hải sản thập cẩm sánh đặc", 109_000, "mi-xao-gion-quang-dong.jpg", noodle));
        dishes.add(buildDish("Mì trộn dầu hào Hồng Kông", "Mì sợi trứng trộn dầu hào và hành lá kiểu Hồng Kông, đơn giản mà đậm vị", 65_000, "mi-tron-dau-hao-hong-kong.jpg", noodle));
        dishes.add(buildDish("Mì cay khô Vũ Hán (Reganmian)", "Mì khô trộn sốt mè và tương ớt kiểu Vũ Hán, món ăn sáng nổi tiếng", 79_000, "mi-cay-vu-han-reganmian.jpg", noodle));
        dishes.add(buildDish("Miến xào cua Thượng Hải", "Miến xào cua kiểu Thượng Hải, sợi miến dai giòn thấm vị hải sản", 129_000, "mien-xao-thuong-hai-cua.jpg", noodle));
        dishes.add(buildDish("Mì hải sản Phúc Kiến", "Mì nước dùng hải sản đậm đà kiểu Phúc Kiến, tôm mực tươi", 119_000, "mi-hai-san-phuc-kien.jpg", noodle));
        dishes.add(buildDish("Mì trường thọ Trường Sinh", "Mì sợi dài truyền thống dùng trong dịp mừng thọ/sinh nhật, nước dùng thanh nhẹ", 99_000, "mi-truong-tho-sinh-nhat.jpg", noodle));

        // 10 Cơm & Cháo
        dishes.add(buildDish("Cơm rang Dương Châu", "Cơm chiên trứng, tôm, xá xíu và đậu Hà Lan kiểu Dương Châu kinh điển", 79_000, "com-rang-duong-chau.jpg", riceCongee));
        dishes.add(buildDish("Cơm gà Hải Nam", "Cơm nấu mỡ gà thơm béo, ăn cùng gà luộc và sốt gừng tỏi", 89_000, "com-ga-hai-nam.jpg", riceCongee));
        dishes.add(buildDish("Cháo trứng bắc thảo thịt bằm Quảng Đông", "Cháo trắng ninh nhuyễn cùng trứng bắc thảo và thịt heo băm", 59_000, "chao-trung-bac-thao-quang-dong.jpg", riceCongee));
        dishes.add(buildDish("Cháo cá Thuận Đức", "Cháo cá tươi thái lát mỏng kiểu Thuận Đức, ngọt thanh không tanh", 69_000, "chao-ca-thuan-duc.jpg", riceCongee));
        dishes.add(buildDish("Cơm thố thịt kho Bắc Kinh", "Cơm nấu trong thố đất cùng thịt kho tàu kiểu Bắc Kinh, đậm đà", 99_000, "com-tho-bac-kinh.jpg", riceCongee));
        dishes.add(buildDish("Cơm chiên trứng muối Triều Châu", "Cơm chiên trộn trứng muối béo bùi, phong cách Triều Châu", 89_000, "com-chien-trung-muoi-trieu-chau.jpg", riceCongee));
        dishes.add(buildDish("Cháo hải sản Phúc Kiến", "Cháo hải sản tôm mực đậm đà kiểu Phúc Kiến, nêm tiêu hành", 89_000, "chao-hai-san-phuc-kien.jpg", riceCongee));
        dishes.add(buildDish("Cơm nị cà ri gà Quảng Đông", "Cơm ăn cùng cà ri gà sánh vàng kiểu Quảng Đông, thơm sả và nước cốt dừa", 99_000, "com-ni-cari-ga-quang-dong.jpg", riceCongee));
        dishes.add(buildDish("Cơm thố lạp xưởng Hồng Kông", "Cơm nấu thố đất cùng lạp xưởng và thịt gà, cháy cạnh thơm giòn kiểu Hồng Kông", 119_000, "com-tho-lap-xuong-hong-kong.jpg", riceCongee));
        dishes.add(buildDish("Cháo trắng Quảng Đông ăn kèm quẩy", "Cháo trắng ninh nhuyễn thanh đạm, ăn kèm quẩy giòn kiểu Quảng Đông", 55_000, "chao-trang-quay-quang-dong.jpg", riceCongee));

        // 10 Nướng & Xiên
        dishes.add(buildDish("Thịt xiên nướng Tân Cương", "Thịt cừu xiên nướng than kiểu Tân Cương, ướp thì là và ớt bột cay nồng", 69_000, "thit-xien-nuong-tan-cuong.jpg", grill));
        dishes.add(buildDish("Vịt quay Bắc Kinh nguyên con", "Vịt quay nguyên con da giòn kiểu Bắc Kinh chính hiệu, ăn kèm bánh tráng và sốt hoisin", 599_000, "vit-quay-bac-kinh-nguyen-con.jpg", grill));
        dishes.add(buildDish("Sườn nướng mật ong ngũ vị", "Sườn heo nướng mật ong tẩm ngũ vị hương, thơm ngọt đậm đà", 179_000, "suon-nuong-mat-ong-trung-hoa.jpg", grill));
        dishes.add(buildDish("Cánh gà nướng ngũ vị hương", "Cánh gà nướng tẩm ngũ vị hương truyền thống Trung Hoa, giòn thơm", 99_000, "canh-ga-nuong-ngu-vi-huong.jpg", grill));
        dishes.add(buildDish("Mực nướng sa tế Trung Hoa", "Mực nướng phết sốt sa tế cay, thơm nức mùi than hoa", 129_000, "muc-nuong-sate-trung-hoa.jpg", grill));
        dishes.add(buildDish("Đậu hũ nướng xiên Tân Cương", "Đậu hũ xiên nướng tẩm ớt bột và thì là kiểu Tân Cương, cay nhẹ", 69_000, "dau-hu-nuong-tan-cuong.jpg", grill));
        dishes.add(buildDish("Bò cuộn hành nướng", "Thịt bò cuộn hành lá nướng than, thơm béo và mềm ngọt", 149_000, "bo-cuon-hanh-nuong.jpg", grill));
        dishes.add(buildDish("Cá nướng cay Tứ Xuyên", "Cá nguyên con nướng phủ sốt cay Tứ Xuyên, đậu phộng và rau thơm", 259_000, "ca-nuong-tu-xuyen-cay.jpg", grill));
        dishes.add(buildDish("Nấm nướng xiên thập cẩm", "Xiên nấm thập cẩm nướng than, tẩm dầu tỏi thơm béo", 69_000, "nam-nuong-xien-trung-hoa.jpg", grill));
        dishes.add(buildDish("Heo sữa quay nguyên con", "Heo sữa quay nguyên con da giòn rụm đặc trưng, món tiệc cao cấp", 459_000, "heo-sua-quay-nguyen-con.jpg", grill));

        // 10 Khai vị / Món nguội
        dishes.add(buildDish("Trứng bách thảo dưa chua gừng", "Trứng bách thảo bổ đôi ăn kèm dưa gừng chua ngọt, món khai vị truyền thống", 45_000, "trung-bach-thao-dua-chua-gung.jpg", coldApp));
        dishes.add(buildDish("Dưa chuột đập tỏi Trung Hoa", "Dưa chuột đập dập trộn tỏi ớt và dầu mè, giòn mát khai vị", 39_000, "dua-chuot-tron-toi-trung-hoa.jpg", coldApp));
        dishes.add(buildDish("Đậu phộng ngũ vị Trung Hoa", "Đậu phộng rang tẩm ngũ vị hương, giòn bùi nhâm nhi", 35_000, "dau-phong-ngu-vi-trung-hoa.jpg", coldApp));
        dishes.add(buildDish("Tai heo trộn Trung Hoa", "Tai heo luộc thái lát trộn dầu mè, tỏi ớt, món nguội giòn sần sật", 59_000, "tai-heo-tron-toi-trung-hoa.jpg", coldApp));
        dishes.add(buildDish("Thịt heo ngâm tương Triều Châu", "Thịt heo ba chỉ ngâm nước tương kiểu Triều Châu, thái lát ăn nguội", 69_000, "thit-heo-ngam-tuong-trieu-chau.jpg", coldApp));
        dishes.add(buildDish("Gà ngâm sốt nước bọt Tứ Xuyên", "Gà luộc thái miếng trộn sốt cay tê Tứ Xuyên, ăn lạnh khai vị", 79_000, "ga-ngam-hoa-tieu-trung-hoa.jpg", coldApp));
        dishes.add(buildDish("Măng tây xào tỏi", "Măng tây xào tỏi giòn ngọt, món khai vị thanh nhẹ", 49_000, "mang-tay-xao-toi-trung-hoa.jpg", coldApp));
        dishes.add(buildDish("Bò khô cay Tứ Xuyên", "Thịt bò khô tẩm cay kiểu Tứ Xuyên, dai giòn nhâm nhi", 89_000, "bo-kho-cay-tu-xuyen-lanh.jpg", coldApp));
        dishes.add(buildDish("Đậu hũ thối Trường Sa", "Đậu hũ lên men chiên giòn kiểu Trường Sa, chấm tương ớt đặc trưng", 45_000, "dau-hu-thoi-truong-sa.jpg", coldApp));
        dishes.add(buildDish("Rau cải trộn dầu mè", "Rau cải luộc trộn dầu mè và tỏi phi, món khai vị thanh đạm", 39_000, "rau-cai-tron-dau-me-trung-hoa.jpg", coldApp));

        // 10 Hải sản Trung Hoa
        dishes.add(buildDish("Tôm sốt trứng muối", "Tôm chiên giòn áo sốt trứng muối béo bùi, món hải sản được ưa chuộng", 189_000, "tom-sot-trung-muoi.jpg", seafood));
        dishes.add(buildDish("Cua rang me", "Cua biển rang sốt me chua ngọt đậm đà, thấm vị đến từng thớ thịt", 349_000, "cua-rang-me.jpg", seafood));
        dishes.add(buildDish("Cá hấp Hồ Nam cay", "Cá hấp sốt cay kiểu Hồ Nam, ớt tươi và tỏi phi thơm nồng", 199_000, "ca-hap-ho-nam-cay.jpg", seafood));
        dishes.add(buildDish("Tôm hùm sốt gừng hành", "Tôm hùm sốt gừng hành thơm lừng, thịt ngọt chắc tự nhiên", 599_000, "tom-hum-sot-gung-hanh.jpg", seafood));
        dishes.add(buildDish("Sò điệp hấp tỏi miến", "Sò điệp hấp tỏi phi cùng miến, giữ trọn vị ngọt tự nhiên", 229_000, "so-diep-hap-toi-trung-hoa.jpg", seafood));
        dishes.add(buildDish("Mực xào sa tế", "Mực tươi xào sốt sa tế cay nhẹ, giòn sần sật đậm đà", 179_000, "muc-xao-sate-trung-hoa.jpg", seafood));
        dishes.add(buildDish("Bào ngư sốt hào", "Bào ngư hầm sốt hào sánh đặc, món cao cấp trong ẩm thực Trung Hoa", 599_000, "bao-ngu-sot-hao-trung-hoa.jpg", seafood));
        dishes.add(buildDish("Cá sông hấp xì dầu", "Cá nguyên con hấp xì dầu hành gừng, vị thanh nhẹ tự nhiên", 169_000, "ca-song-hap-xi-dau.jpg", seafood));
        dishes.add(buildDish("Tôm chiên miếng quế", "Tôm tẩm bột chiên giòn tan, chấm sốt chua ngọt", 149_000, "tom-chien-mieng-que.jpg", seafood));
        dishes.add(buildDish("Lươn xào sa tế Phúc Kiến", "Lươn xào sốt sa tế đậm đà kiểu Phúc Kiến, thịt lươn dai ngọt", 199_000, "luon-xao-sate-phuc-kien.jpg", seafood));

        // 10 Tráng miệng Trung Hoa
        dishes.add(buildDish("Bánh trứng Hồng Kông", "Bánh trứng nướng giòn xốp kiểu Hồng Kông, thơm bơ béo ngậy", 45_000, "banh-trung-hong-kong.jpg", dessertCn));
        dishes.add(buildDish("Chè hạt sen tuyết yến", "Chè hạt sen nấu cùng tuyết yến thanh mát, bồi bổ sức khoẻ", 65_000, "che-hat-sen-tuyet-yen.jpg", dessertCn));
        dishes.add(buildDish("Bánh quẩy đường chiên", "Bánh quẩy giòn rắc đường, món ăn vặt truyền thống Trung Hoa", 35_000, "banh-qua-duong-chien.jpg", dessertCn));
        dishes.add(buildDish("Chè vừng đen Trung Hoa", "Chè mè đen sánh mịn, thơm béo và bổ dưỡng", 45_000, "che-vung-den-trung-hoa.jpg", dessertCn));
        dishes.add(buildDish("Bánh trung thu mini", "Bánh trung thu nhân đậu xanh/hạt sen cỡ nhỏ, vỏ mềm dẻo", 55_000, "banh-trung-thu-mini.jpg", dessertCn));
        dishes.add(buildDish("Xôi nước (Thang Viên) Trung Hoa", "Viên bột nếp nhân mè đen trong nước đường gừng ấm nóng", 49_000, "xoi-nuoc-trung-hoa-tangyuan.jpg", dessertCn));
        dishes.add(buildDish("Chè đậu xanh Trung Hoa", "Chè đậu xanh nấu nhuyễn thanh mát, vị ngọt dịu nhẹ", 39_000, "che-dau-xanh-trung-hoa.jpg", dessertCn));
        dishes.add(buildDish("Thạch hạnh nhân Trung Hoa", "Thạch hạnh nhân mềm mịn ăn cùng trái cây, thanh mát giải nhiệt", 45_000, "banh-trang-mieng-hanh-nhan.jpg", dessertCn));
        dishes.add(buildDish("Bánh vừng chiên (Jian Dui)", "Bánh nếp chiên phủ mè rang, vỏ giòn nhân đậu ngọt bên trong", 49_000, "banh-bao-chien-dua-ngot.jpg", dessertCn));
        dishes.add(buildDish("Chè xoài sago bưởi", "Chè xoài tươi cùng sago và bưởi, mát lạnh sảng khoái", 59_000, "che-xoai-sago-trung-hoa.jpg", dessertCn));

        // 10 Món Việt
        dishes.add(buildDish("Phở bò tái", "Phở bò truyền thống nước dùng hầm xương ninh nhiều giờ, thịt bò tái mềm", 79_000, "pho-bo-tai.jpg", vietnamese));
        dishes.add(buildDish("Bún chả Hà Nội", "Bún ăn kèm chả nướng than hoa và nước chấm chua ngọt kiểu Hà Nội", 89_000, "bun-cha-ha-noi.jpg", vietnamese));
        dishes.add(buildDish("Cơm tấm sườn bì chả", "Cơm tấm sườn nướng, bì và chả trứng, ăn kèm nước mắm chua ngọt", 89_000, "com-tam-suon-bi-cha.jpg", vietnamese));
        dishes.add(buildDish("Gỏi cuốn tôm thịt", "Cuốn bánh tráng tôm thịt, bún và rau sống, chấm tương đậu phộng", 59_000, "goi-cuon-tom-thit.jpg", vietnamese));
        dishes.add(buildDish("Chả giò (nem rán)", "Nem cuốn nhân thịt và mộc nhĩ chiên giòn, chấm nước mắm chua ngọt", 65_000, "cha-gio-nem-ran.jpg", vietnamese));
        dishes.add(buildDish("Canh chua cá lóc", "Canh chua cá lóc nấu me, dứa và giá đỗ, đậm vị miền Tây Nam Bộ", 99_000, "canh-chua-ca-loc.jpg", vietnamese));
        dishes.add(buildDish("Bò lá lốt nướng", "Thịt bò cuộn lá lốt nướng than, thơm mùi lá lốt đặc trưng", 109_000, "bo-la-lot-nuong.jpg", vietnamese));
        dishes.add(buildDish("Gà kho gừng", "Gà kho gừng đậm đà, cay ấm và thơm nồng kiểu gia đình Việt", 99_000, "ga-kho-gung.jpg", vietnamese));
        dishes.add(buildDish("Bún bò Huế", "Bún bò Huế cay nồng đặc trưng, giò heo và chả cua", 89_000, "bun-bo-hue.jpg", vietnamese));
        dishes.add(buildDish("Cá kho tộ", "Cá lóc kho tộ đậm vị nước mắm và đường thắng, ăn cùng cơm trắng", 119_000, "ca-kho-to.jpg", vietnamese));

        // 15 Đồ uống
        dishes.add(buildDish("Trà hoa cúc Trung Hoa", "Trà hoa cúc thanh mát, thanh nhiệt và dịu nhẹ", 25_000, "tra-hoa-cuc-trung-hoa.jpg", drink));
        dishes.add(buildDish("Trà ô long Đài Loan", "Trà ô long thơm đậm, hậu vị ngọt thanh đặc trưng Đài Loan", 35_000, "tra-o-long-dai-loan.jpg", drink));
        dishes.add(buildDish("Trà sữa trân châu đường đen", "Trà sữa béo ngậy cùng trân châu đường đen dẻo dai", 55_000, "tra-sua-tran-chau-duong-den.jpg", drink));
        dishes.add(buildDish("Nước mơ chua ngọt Trung Hoa", "Nước mơ chua ngọt giải khát kiểu Trung Hoa truyền thống", 39_000, "nuoc-mo-chua-ngot-trung-hoa.jpg", drink));
        dishes.add(buildDish("Trà bí đao Trung Hoa", "Trà bí đao thanh mát, giải nhiệt và ít ngọt", 25_000, "tra-bi-dao-trung-hoa.jpg", drink));
        dishes.add(buildDish("Sữa đậu nành nóng", "Sữa đậu nành nóng thơm béo, món uống sáng quen thuộc", 25_000, "sua-dau-nanh-nong.jpg", drink));
        dishes.add(buildDish("Nước la hán quả", "Nước la hán quả thanh mát, vị ngọt dịu tự nhiên", 35_000, "nuoc-la-han-qua.jpg", drink));
        dishes.add(buildDish("Trà vải Trung Hoa", "Trà trái vải thơm ngọt tự nhiên, giải khát sảng khoái", 45_000, "tra-vai-trung-hoa.jpg", drink));
        dishes.add(buildDish("Trà nhài Trung Hoa", "Trà nhài thơm nhẹ nhàng, thanh đạm dễ uống", 25_000, "tra-nhai-trung-hoa.jpg", drink));
        dishes.add(buildDish("Coca Cola lon", "Nước ngọt có ga Coca-Cola lon 330ml", 20_000, "coca-cola-lon.jpg", drink));
        dishes.add(buildDish("Sprite lon", "Nước ngọt có ga vị chanh Sprite lon 330ml", 20_000, "sprite-lon.jpg", drink));
        dishes.add(buildDish("Nước cam ép", "Nước cam vắt tươi nguyên chất, giàu vitamin C", 45_000, "nuoc-cam-ep.jpg", drink));
        dishes.add(buildDish("Nước chanh dây", "Nước chanh dây chua ngọt sảng khoái, giải khát tự nhiên", 39_000, "nuoc-chanh-day.jpg", drink));
        dishes.add(buildDish("Bia Tsingtao", "Bia Tsingtao Trung Quốc, vị nhẹ và thơm mát", 45_000, "bia-tsingtao.jpg", drink));
        dishes.add(buildDish("Nước suối", "Nước khoáng đóng chai 500ml", 15_000, "nuoc-suoi-lavie.jpg", drink));

        dishRepository.saveAll(dishes);
    }

    private Category buildCategory(String name, String description)
    {
        Category c = new Category();
        c.setName(name);
        c.setDescription(description);
        c.setAvailable(true);
        return c;
    }

    private Dish buildDish(String name, String description, int price, String imageUrl, Category category)
    {
        Dish d = new Dish();
        d.setName(name);
        d.setDescription(description);
        d.setPrice(price);
        d.setImageUrl(imageUrl);
        d.setAvailable(true);
        d.setCategory(category);
        return d;
    }


    // ══════════════════════════════════════════════════════════════════
    // Orders lịch sử – 3000 order, rải ngẫu nhiên từ đầu năm 2025 đến gần
    // hiện tại. Toàn bộ đã thanh toán thành công (có Invoice + Payment) nên
    // Order luôn ở trạng thái COMPLETED; từng OrderItem chủ yếu COMPLETED,
    // một tỉ lệ nhỏ (~8%) bị CANCELLED. Phương thức thanh toán (CASH /
    // QRCODE) chọn ngẫu nhiên cho mỗi order.
    //
    // LƯU Ý VỀ AUDITING: Order/OrderItem/Invoice/Payment/PaymentTransaction
    // đều dùng @EntityListeners(AuditingEntityListener.class) nên các cột
    // @CreatedDate (createdAt/invoiceDate/paymentDate/transactionDate) và
    // @LastModifiedDate (updatedAt) sẽ luôn bị Spring Data JPA auditing ghi
    // đè thành thời điểm chạy seeder thực tế ngay khi save() được gọi — bất
    // kể ta đã set giá trị "quá khứ" trước đó. Vì không được sửa entity, ta
    // để auditing set như bình thường, sau đó UPDATE thẳng qua SQL thuần
    // (JdbcTemplate) để ghi đè lại đúng mốc thời gian mong muốn — vì UPDATE
    // thuần không đi qua vòng đời entity/@PrePersist nên auditing không có
    // cơ hội can thiệp lại lần nữa. Toàn bộ được gom lại và chạy 1 lần bằng
    // batchUpdate() sau vòng lặp để tránh 15.000 lượt round-trip riêng lẻ.
    // ══════════════════════════════════════════════════════════════════
    private void seedHistoricalOrders()
    {
        if (orderRepository.count() > 0) return;

        List<RestaurantTable> allTables = tableRepository.findAll();
        List<Dish> dishes = dishRepository.findAll();

        User waiter = userRepository.findAll().stream()
                .filter(u -> u.getRole() == RoleType.WAITER).toList().getFirst();

        // Chừa lại 3 giờ gần nhất để không đụng với các order đang SERVING "thời gian thực"
        LocalDateTime historyEnd = LocalDateTime.now().minusHours(3);

        // Sinh trước toàn bộ mốc thời gian rồi sort tăng dần, để khi insert theo
        // đúng thứ tự này thì auto-increment ID của Order cũng tăng dần theo
        // thời gian TẠO đơn.
        List<LocalDateTime> orderTimes = new ArrayList<>(HISTORICAL_ORDER_COUNT);
        for (int i = 0; i < HISTORICAL_ORDER_COUNT; i++)
        {
            orderTimes.add(randomDateTimeBetween(HISTORY_START, historyEnd));
        }
        orderTimes.sort(Comparator.naturalOrder());

        // Gom các cặp (thời gian đúng, id) lại để backdate hàng loạt sau vòng lặp,
        // thay vì UPDATE từng dòng một (rất chậm với 3000 order).
        List<Object[]> orderBackdates = new ArrayList<>();
        List<Object[]> itemBackdates = new ArrayList<>();
        List<Object[]> invoiceBackdates = new ArrayList<>();
        List<Object[]> paymentBackdates = new ArrayList<>();
        List<Object[]> transactionBackdates = new ArrayList<>();

        // ─── Giai đoạn 1: tạo Order + OrderItem theo đúng thứ tự orderTime
        // tăng dần (order_id tăng theo thời gian TẠO đơn). Chưa tạo Invoice/
        // Payment ngay ở đây — chỉ tính trước invoiceDate và gom lại, để giai
        // đoạn 2 sort riêng theo invoiceDate trước khi insert. ───
        record PendingInvoice(Order order, LocalDateTime invoiceDate) {}

        List<PendingInvoice> pendingInvoices = new ArrayList<>(HISTORICAL_ORDER_COUNT);

        for (LocalDateTime orderTime : orderTimes)
        {
            RestaurantTable table = allTables.get(RNG.nextInt(allTables.size()));

            Order order = buildOrder(table, waiter, OrderStatus.COMPLETED, orderTime);

            // Build items và gắn vào order qua addOrderItem() để đồng bộ 2 chiều
            // (order.orderItems <-> item.order), tránh Hibernate hiểu nhầm
            // collection rỗng rồi orphanRemoval xoá mất item ở lần save thứ 2.
            List<OrderItem> items = buildRandomOrderItems(order, dishes, orderTime);
            items.forEach(order::addOrderItem);

            // Chụp lại createdAt gốc TRƯỚC khi save() — vì auditing sẽ ghi đè
            // thẳng field createdAt trong bộ nhớ của item thành now() lúc insert,
            // nên đọc lại item.getCreatedAt() sau save() sẽ cho giá trị sai.
            List<LocalDateTime> originalItemTimes = items.stream()
                    .map(OrderItem::getCreatedAt)
                    .toList();

            recalcTotal(order, items);
            orderRepository.save(order);   // save 1 lần duy nhất, cascade lo phần OrderItem

            orderBackdates.add(new Object[]{Timestamp.valueOf(orderTime), order.getId()});

            for (int i = 0; i < items.size(); i++)
            {
                OrderItem item = items.get(i);
                Timestamp ts = Timestamp.valueOf(originalItemTimes.get(i));
                itemBackdates.add(new Object[]{ts, ts, item.getId()});
            }

            LocalDateTime invoiceDate = orderTime.plusMinutes(60 + RNG.nextInt(90));
            pendingInvoices.add(new PendingInvoice(order, invoiceDate));
        }

        // ─── Giai đoạn 2: tạo Invoice + Payment theo đúng thứ tự invoiceDate
        // tăng dần — để invoice_id/payment_id tăng đúng theo thời gian THANH
        // TOÁN thực tế (khách thanh toán trước nhận mã hóa đơn nhỏ hơn), độc
        // lập với thứ tự tạo đơn ở giai đoạn 1. ───
        List<PendingInvoice> sortedByInvoiceDate = new ArrayList<>(pendingInvoices);
        sortedByInvoiceDate.sort(Comparator.comparing(PendingInvoice::invoiceDate));

        for (PendingInvoice pending : sortedByInvoiceDate)
        {
            Order order = pending.order();
            LocalDateTime invoiceDate = pending.invoiceDate();

            Invoice invoice = buildInvoice(order, invoiceDate);
            invoiceRepository.save(invoice);
            invoiceBackdates.add(new Object[]{Timestamp.valueOf(invoiceDate), invoice.getId()});

            PaymentMethod method = RNG.nextBoolean() ? PaymentMethod.CASH : PaymentMethod.QRCODE;
            LocalDateTime paymentDate = invoiceDate.plusMinutes(1 + RNG.nextInt(5));
            Payment payment = buildPayment(invoice, method, paymentDate);
            paymentRepository.save(payment);
            paymentBackdates.add(new Object[]{Timestamp.valueOf(paymentDate), payment.getId()});

            if (method == PaymentMethod.QRCODE)
            {
                LocalDateTime txDate = paymentDate.plusSeconds(2);
                PaymentTransaction tx = buildPaymentTransaction(payment, txDate);
                paymentTransactionRepository.save(tx);
                transactionBackdates.add(new Object[]{Timestamp.valueOf(txDate), tx.getId()});
            }
        }

        // Ghi đè hàng loạt các cột do auditing tự set = now() về lại đúng mốc thời gian mong muốn
        jdbcTemplate.batchUpdate("UPDATE orders SET created_at = ? WHERE order_id = ?", orderBackdates);
        jdbcTemplate.batchUpdate("UPDATE order_items SET created_at = ?, updated_at = ? WHERE order_item_id = ?", itemBackdates);
        jdbcTemplate.batchUpdate("UPDATE invoices SET invoice_date = ? WHERE invoice_id = ?", invoiceBackdates);
        jdbcTemplate.batchUpdate("UPDATE payments SET payment_date = ? WHERE payment_id = ?", paymentBackdates);
        if (!transactionBackdates.isEmpty())
        {
            jdbcTemplate.batchUpdate("UPDATE payment_transaction SET transaction_date = ? WHERE transaction_id = ?", transactionBackdates);
        }
    }

    private List<OrderItem> buildRandomOrderItems(Order order, List<Dish> dishes, LocalDateTime orderTime)
    {
        int itemCount = 1 + RNG.nextInt(5); // 1-5 món mỗi order
        List<OrderItem> items = new ArrayList<>();
        boolean hasNonCancelled = false;

        for (int i = 0; i < itemCount; i++)
        {
            Dish dish = dishes.get(RNG.nextInt(dishes.size()));
            int qty = 1 + RNG.nextInt(3);
            LocalDateTime itemTime = orderTime.plusMinutes(RNG.nextInt(10));
            boolean isLastItem = (i == itemCount - 1);

            OrderItemStatus status;
            if (!hasNonCancelled && isLastItem)
            {
                // Đảm bảo order luôn có ít nhất 1 món không bị huỷ (order đã thanh toán thành công)
                status = OrderItemStatus.COMPLETED;
            }
            else
            {
                status = RNG.nextInt(100) < 8 ? OrderItemStatus.CANCELLED : OrderItemStatus.COMPLETED;
            }
            if (status != OrderItemStatus.CANCELLED) hasNonCancelled = true;

            items.add(buildItem(order, dish, qty, null, status, itemTime));
        }
        return items;
    }

    // Random ngày trong khoảng [start, end], sau đó random giờ riêng trong khung
    // 8h00 - 19h59 (đảm bảo luôn <= 20h00) để khớp giờ hoạt động của nhà hàng.
    private LocalDateTime randomDateTimeBetween(LocalDateTime start, LocalDateTime end)
    {
        long startDay = start.toLocalDate().toEpochDay();
        long endDay = end.toLocalDate().toEpochDay();
        long randomDay = startDay + (long) (RNG.nextDouble() * (endDay - startDay + 1));
        LocalDate date = LocalDate.ofEpochDay(Math.min(randomDay, endDay));

        int hour = 8 + RNG.nextInt(12);   // 8 - 19h
        int minute = RNG.nextInt(60);
        LocalDateTime candidate = LocalDateTime.of(date, LocalTime.of(hour, minute));

        // Nếu ngày random ra trùng đúng ngày cuối (end.toLocalDate()) thì giờ random
        // ra không được vượt quá "end" thực tế (tránh sinh mốc thời gian tương lai
        // khi ngày được chọn là hôm nay nhưng giờ hiện tại chưa tới 20h).
        if (candidate.isAfter(end))
        {
            candidate = end;
        }

        return candidate;
    }


    // ══════════════════════════════════════════════════════════════════
    // 7 order đang phục vụ tại thời điểm hiện tại (khớp với 7 bàn đang
    // SERVING: T01, T02, T03, T05, T06, T07, T08). Mỗi order có 2-5 món,
    // từng món ở trạng thái COMPLETED hoặc PREPARING; chưa có Invoice/Payment
    // vì khách chưa thanh toán.
    //
    // Các order này chỉ lệch "vài chục phút" so với now() nên việc auditing
    // ghi đè createdAt = now() gần như không đáng kể — nhưng vẫn backdate lại
    // cho chính xác 100% (số lượng nhỏ nên update từng dòng, không cần batch).
    // ══════════════════════════════════════════════════════════════════
    private void seedLiveServingOrders()
    {
        List<RestaurantTable> allTables = tableRepository.findAll();
        allTables.sort(Comparator.comparing(RestaurantTable::getTableNumber));
        List<Dish> dishes = dishRepository.findAll();

        User waiter = userRepository.findAll().stream()
                .filter(u -> u.getRole() == RoleType.WAITER)
                .findFirst()
                .orElseThrow();

        List<String> servingTableNumbers = List.of("T01", "T02", "T03", "T05", "T06", "T07", "T08");
        LocalDateTime now = LocalDateTime.now();

        // Sinh createdAt trước cho từng bàn, rồi sort tăng dần theo thời gian
        // trước khi insert, để ID cũng tăng đúng thứ tự thời gian.
        record LivePlan(RestaurantTable table, LocalDateTime createdAt) {}

        List<LivePlan> plans = servingTableNumbers.stream()
                .map(tn -> new LivePlan(getTable(allTables, tn), now.minusMinutes(15 + RNG.nextInt(45))))
                .sorted(Comparator.comparing(LivePlan::createdAt))
                .toList();

        for (LivePlan plan : plans)
        {
            RestaurantTable table = plan.table();
            LocalDateTime createdAt = plan.createdAt();

            Order order = buildOrder(table, waiter, OrderStatus.SERVING, createdAt);

            int itemCount = 2 + RNG.nextInt(4);
            List<OrderItem> items = new ArrayList<>();
            for (int i = 0; i < itemCount; i++)
            {
                Dish dish = dishes.get(RNG.nextInt(dishes.size()));
                int qty = 1 + RNG.nextInt(3);
                LocalDateTime itemTime = createdAt.plusMinutes(2 + RNG.nextInt(10));
                OrderItemStatus status = RNG.nextBoolean() ? OrderItemStatus.COMPLETED : OrderItemStatus.PREPARING;
                items.add(buildItem(order, dish, qty, null, status, itemTime));
            }
            items.forEach(order::addOrderItem);

            recalcTotal(order, items);
            orderRepository.save(order);
            jdbcTemplate.update("UPDATE orders SET created_at = ? WHERE order_id = ?",
                    Timestamp.valueOf(createdAt), order.getId());

            for (OrderItem item : items)
            {
                jdbcTemplate.update("UPDATE order_items SET created_at = ?, updated_at = ? WHERE order_item_id = ?",
                        Timestamp.valueOf(item.getCreatedAt()), Timestamp.valueOf(item.getCreatedAt()), item.getId());
            }
        }
    }

    private Order buildOrder(RestaurantTable table, User createdBy, OrderStatus status, LocalDateTime createdAt)
    {
        Order order = new Order();
        order.setTable(table);
        order.setCreatedBy(createdBy);
        order.setStatus(status);
        order.setTotalAmount(BigDecimal.ZERO);   // recalculated by recalcTotal()
        order.setCreatedAt(createdAt);
        return order;
    }

    private OrderItem buildItem(Order order, Dish dish, int qty, String note,
                                OrderItemStatus status, LocalDateTime createdAt)
    {
        OrderItem item = new OrderItem();
        item.setOrder(order);
        item.setDish(dish);
        item.setDishNameSnapshot(dish.getName());
        item.setQuantity(qty);
        item.setUnitPrice(BigDecimal.valueOf(dish.getPrice()));
        item.setSubTotal(BigDecimal.valueOf((long) dish.getPrice() * qty));
        item.setNote(note);
        item.setStatus(status);
        item.setCreatedAt(createdAt);
        return item;
    }

    /**
     * Sums subtotals of non-CANCELLED items and updates the order's totalAmount.
     */
    private void recalcTotal(Order order, List<OrderItem> items)
    {
        BigDecimal total = items.stream()
                .filter(i -> i.getStatus() != OrderItemStatus.CANCELLED)
                .map(OrderItem::getSubTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setTotalAmount(total);
    }

    private Invoice buildInvoice(Order order, LocalDateTime invoiceDate)
    {
        BigDecimal restaurantRevenueAmount =
                order.getTotalAmount() == null
                        ? BigDecimal.ZERO
                        : order.getTotalAmount().setScale(0, RoundingMode.HALF_UP);

        Invoice invoice = new Invoice();
        invoice.setOrder(order);
        invoice.setFinalAmount(
                restaurantRevenueAmount
                        .multiply(new BigDecimal("1.10"))
                        .setScale(0, RoundingMode.HALF_UP)
        );
        invoice.setRestaurantRevenueAmount(restaurantRevenueAmount);
        invoice.setInvoiceDate(invoiceDate);
        return invoice;
    }

    private Payment buildPayment(Invoice invoice, PaymentMethod method, LocalDateTime paymentDate)
    {
        Payment payment = new Payment();
        payment.setInvoice(invoice);
        payment.setPaymentMethod(method);
        payment.setAmount(invoice.getFinalAmount());
        payment.setSuccess(true);
        payment.setPaymentDate(paymentDate);
        return payment;
    }

    private PaymentTransaction buildPaymentTransaction(Payment payment, LocalDateTime transactionDate)
    {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setPayment(payment);
        tx.setTransactionCode("QR" + (100_000_000 + RNG.nextInt(900_000_000)));
        tx.setGateway("VNPAY");
        tx.setGatewayResponse("{\"status\":\"SUCCESS\",\"code\":\"00\"}");
        tx.setSuccess(true);
        tx.setTransactionDate(transactionDate);
        return tx;
    }

    private void backfillInvoiceRestaurantRevenueAmount()
    {
        List<Invoice> invoices =
                invoiceRepository.findByRestaurantRevenueAmountIsNull();

        if (invoices.isEmpty())
        {
            return;
        }

        invoices.forEach(invoice ->
        {
            BigDecimal restaurantRevenueAmount;

            if (invoice.getOrder() != null && invoice.getOrder().getTotalAmount() != null)
            {
                restaurantRevenueAmount =
                        invoice.getOrder().getTotalAmount().setScale(0, RoundingMode.HALF_UP);
            } else
            {
                restaurantRevenueAmount = invoice.getFinalAmount()
                        .divide(new BigDecimal("1.10"), 0, RoundingMode.HALF_UP);
            }

            invoice.setRestaurantRevenueAmount(restaurantRevenueAmount);
        });

        invoiceRepository.saveAll(invoices);
    }


    // ══════════════════════════════════════════════════════════════════
    // Reservations – 5 đơn:
    //   2 đơn WAITING cách hiện tại 15 phút (khớp 2 bàn RESERVED: T04, T10)
    //   3 đơn QUEUED cho những ngày sắp tới (còn trong hàng chờ, chưa tới giờ)
    // ══════════════════════════════════════════════════════════════════
    private void seedReservations()
    {
        if (reservationRepository.count() > 0) return;

        List<RestaurantTable> allTables = tableRepository.findAll();
        RestaurantTable t04 = getTable(allTables, "T04");
        RestaurantTable t10 = getTable(allTables, "T10");
        RestaurantTable t09 = getTable(allTables, "T09");
        RestaurantTable t11 = getTable(allTables, "T11");
        RestaurantTable t12 = getTable(allTables, "T12");

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime arrivalSoon = now.plusMinutes(15);

        List<Reservation> reservations = List.of(
                buildReservation(t04, "Nguyễn Thị Lan", "0912345678",
                        arrivalSoon, "Kỷ niệm ngày cưới, cần bàn yên tĩnh", ReservationStatus.WAITING),
                buildReservation(t10, "Trần Văn Minh", "0987654321",
                        arrivalSoon, "Nhóm 6 người, cần ghế cao cho trẻ em", ReservationStatus.WAITING),
                buildReservation(t09, "Lê Thị Hoa", "0934567890",
                        now.plusDays(1).withHour(18).withMinute(30),
                        "Sinh nhật, cần trang trí bàn", ReservationStatus.QUEUED),
                buildReservation(t11, "Phạm Văn Đức", "0945678901",
                        now.plusDays(2).withHour(19).withMinute(0),
                        "Họp mặt gia đình 8 người", ReservationStatus.QUEUED),
                buildReservation(t12, "Hoàng Thị Mai", "0956789012",
                        now.plusDays(3).withHour(12).withMinute(0),
                        "Đặt bàn trưa, nhóm công ty", ReservationStatus.QUEUED)
        );

        reservationRepository.saveAll(reservations);
    }

    private Reservation buildReservation(RestaurantTable table, String customerName,
                                         String phone, LocalDateTime reservationTime, String note,
                                         ReservationStatus status)
    {
        Reservation r = new Reservation();
        r.setTable(table);
        r.setCustomerName(customerName);
        r.setPhone(phone);
        r.setReservationTime(reservationTime);
        r.setNote(note);
        r.setStatus(status);
        return r;
    }


    // ══════════════════════════════════════════════════════════════════
    // Utility helpers
    // ══════════════════════════════════════════════════════════════════
    private RestaurantTable getTable(List<RestaurantTable> tables, String tableNumber)
    {
        return tables.stream()
                .filter(t -> t.getTableNumber().equals(tableNumber))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Không tìm thấy bàn: " + tableNumber));
    }
}
