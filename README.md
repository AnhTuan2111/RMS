# RIMS - Restaurant Internal Management System

## Dự án môn học SWP391 - FPT
Thành viên tham gia:
|MSSV     |Tên                 |
|---------|--------------------|
|HE190385 |Nguyễn Thành Vinh   |
|HE194015 |Phạm Tuấn Anh       |
|HE172532 |Nguyễn Thị Thu Hiền |
|HE191779 |Nguyễn Xuân Bắc     |
|HE191410 |Phạm Minh Nghĩa     |
|HE200426 |Nguyễn Anh Tuấn     |

Hệ thống quản lý nhà hàng gồm 2 phần:
- **Backend**: Spring Boot (Java) - `backend/rims-api`
- **Frontend**: React + TypeScript + Vite - `frontend`

## 1. Yêu cầu môi trường

| Thành phần | Phiên bản đề xuất                                    |
|------------|------------------------------------------------------|
| JDK        | 21+ (theo Spring Boot 3.x)                           |
| Maven      | dùng kèm Maven Wrapper (`mvnw`), không cần cài riêng |
| Node.js    | 19                                                   |
| npm        | đi kèm Node.js                                       |
| SQL Server | 2019+ (đã bật TCP/IP, port 1433)                     |
| SMTP Gmail | tài khoản dùng để gửi mail (OTP, thông báo...)       |

## 2. Cấu trúc thư mục chính

```
.
├── backend/
│   └── rims-api/            # Spring Boot API
│       ├── src/main/java/vn/edu/fpt/swp391/g6/rimsapi/
│       │   ├── config/       # CORS, Security, WebSocket, VNPay, DB seeder
│       │   ├── controller/   # Admin, Auth, Cashier, Chef, Customer, Waiter
│       │   ├── dto/          # Request/Response DTOs
│       │   ├── entity/       # JPA Entities
│       │   ├── repository/   # Spring Data Repositories
│       │   ├── security/     # JWT, Security filters
│       │   └── service/      # Business logic
│       ├── mvnw / mvnw.cmd
│       └── pom.xml
│
└── frontend/
    └── src/
        ├── app/               # Providers, routes (Admin/Auth/Cashier/Chef/Customer/Waiter)
        ├── features/          # Các trang theo vai trò (admin, cashier, chef, waiter...)
        ├── realtime/          # WebSocket (SockJS + StompJS)
        ├── shared/            # api client, components, hooks, types, utils
        └── styles/            # Bootstrap tuỳ biến theo từng module
```

## 3. Cấu hình Backend

Cấu hình dùng chung nằm ở `backend/rims-api/src/main/resources/application.yaml` và **được commit**.
File này chỉ chứa placeholder, không chứa giá trị bí mật nào.

### 3.1. Điền secret cho máy của bạn

Copy file mẫu rồi điền giá trị thật:

```bash
cd backend/rims-api/src/main/resources
cp application-local.yaml.example application-local.yaml
```

`application-local.yaml` đã nằm trong `.gitignore` nên không bao giờ bị commit.
Spring tự nạp file này và ghi đè lên `application.yaml`.

Bốn giá trị bắt buộc phải điền — thiếu là app không khởi động được:

| Khoá | Là gì | Lấy ở đâu |
|---|---|---|
| `spring.datasource.password` | Mật khẩu SQL Server | Bạn đặt khi cài SQL Server |
| `spring.mail.username` / `password` | Tài khoản gửi OTP | App Password 16 ký tự của Gmail, tạo tại [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (phải bật xác thực 2 bước trước) |
| `jwt.signerKey` | Khoá ký JWT | Tự sinh: `openssl rand -base64 48` |
| `vnpay.hash-secret` | Khoá ký giao dịch VNPay | Trong tài khoản sandbox VNPay |

Cách khác nếu không muốn dùng file: đặt biến môi trường `DB_PASSWORD`, `MAIL_USERNAME`,
`MAIL_PASSWORD`, `JWT_SIGNER_KEY`, `VNPAY_HASH_SECRET`.

### 3.2. Database (SQL Server)

Tạo database `RIMS_DB` trên SQL Server (hoặc đổi tên rồi sửa biến môi trường `DB_URL`).

Về `ddl-auto`:

- **Mặc định là `update`** — giữ nguyên dữ liệu giữa các lần khởi động.
- **Profile `dev` dùng `create`** — dựng lại schema sạch và nạp dữ liệu mẫu.

### 3.3. Chạy Backend

Từ thư mục `backend/rims-api`:

**Lần đầu tiên** (tạo schema + nạp dữ liệu mẫu: tài khoản, bàn, món ăn, 3000 order lịch sử):

```bash
# Windows
mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev

# macOS/Linux
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

**Các lần sau** (giữ nguyên dữ liệu — dùng cái này khi demo):

```bash
# Windows
mvnw.cmd spring-boot:run

# macOS/Linux
./mvnw spring-boot:run
```

`DatabaseSeeder` chỉ chạy ở profile `dev` vì nó tạo tài khoản với mật khẩu mặc định `123456`.
Mỗi bước seed đều kiểm tra `count() > 0` nên chạy lại nhiều lần không tạo dữ liệu trùng.

Server mặc định chạy tại: `http://localhost:8080`

### 3.4. VNPay

Cấu hình mặc định trỏ tới **sandbox**. Khi deploy thật cần đổi `vnpay.url`,
`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` theo tài khoản merchant, và `VNPAY_RETURN_URL` theo domain thật.

## 4. Cấu hình & chạy Frontend

Từ thư mục `frontend`:

### 4.1. Cài đặt dependencies

```bash
npm install
```

### 4.2. Các script có sẵn (`package.json`)

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy dev server (Vite) |
| `npm run build` | Kiểm tra type (`tsc -b`) rồi build production |
| `npm run preview` | Preview bản build |
| `npm run lint` | Kiểm tra lỗi ESLint |
| `npm run typecheck` | Chỉ kiểm tra kiểu TypeScript |

### 4.3. Chạy môi trường dev

```bash
npm run dev
```

Mặc định Vite sẽ chạy ở `http://localhost:5173` (kiểm tra terminal để biết chính xác cổng).

### 4.4. Kết nối tới Backend

Frontend gọi API qua `axios` (`frontend/src/shared/api/client.ts`) và kết nối realtime qua `sockjs-client` + `stompjs` (`frontend/src/realtime/stompClient.ts`). Đảm bảo:
- Backend đang chạy ở `http://localhost:8080`.
- CORS ở backend (`CorsConfig.java`) cho phép origin của frontend dev server.
- Nếu cấu hình base URL API khác, kiểm tra biến môi trường/constant trong `client.ts` và các file trong `shared/api/`.

## 5. Thứ tự khởi động khuyến nghị

1. Khởi động SQL Server, tạo database `RIMS_DB`.
2. Cập nhật `application.yaml` với thông tin DB/mail/VNPay của bạn.
3. Chạy backend (`./mvnw spring-boot:run`) → API sẵn sàng tại `:8080`.
4. Chạy frontend (`npm run dev`) → mở trình duyệt theo địa chỉ Vite in ra.
5. Đăng nhập/đăng ký thử để kiểm tra luồng Auth → Order → Payment → Realtime (WebSocket).

## 6. Công nghệ sử dụng

**Backend**: Java 21, Spring Boot, Spring Data JPA, Spring Security (JWT), WebSocket (STOMP), SQL Server, VNPay integration, Spring Mail.

**Frontend**: React 19, TypeScript, Vite, React Router 7, Axios, Bootstrap 5, SockJS + StompJS (realtime), ESLint.
