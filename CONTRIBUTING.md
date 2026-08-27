# Quy ước code RIMS

Những gì công cụ tự kiểm tra được thì không cần nhớ. Tài liệu này chỉ ghi phần **máy không
kiểm tra hộ**.

## Trước khi commit

```bash
# Backend — tự động khi chạy mvn compile
cd backend/rims-api && mvn spotless:apply

# Frontend
cd frontend && npm run format && npm run lint && npm run typecheck
```

Bật ignore-revs một lần cho máy của bạn để `git blame` bỏ qua các commit chỉ đổi format:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Backend (Java / Spring Boot)

| Chủ đề | Quy tắc |
|---|---|
| **Đặt tên** | Controller `XxxController` · interface `XxxService` + impl `XxxServiceImpl` · request DTO `<Verb><Noun>Request` · response DTO `<Noun>Response`. Không viết tắt (`tableRepository`, không `tableRepo`). |
| **Lombok trên DTO** | Đúng một tổ hợp: `@Getter @Builder @NoArgsConstructor @AllArgsConstructor`. Không `@Setter` trên DTO response. |
| **Lombok trên Entity** | `@Getter @Setter @NoArgsConstructor @AllArgsConstructor`. **Cấm `@Data`** — nó sinh `equals`/`hashCode` chạm vào lazy collection, gây `LazyInitializationException` và sai khi entity nằm trong `Set`. |
| **Controller** | Chỉ nhận request, gọi service, trả DTO. Không có `if` nghiệp vụ. Trả `ResponseEntity` khi cần đổi status (201/204), trả thẳng DTO khi là 200. |
| **Service** | Mọi method public có `@Transactional` hoặc `@Transactional(readOnly = true)` — bản của **Spring**, không phải `jakarta.transaction`. File > 500 dòng phải tách. |
| **Exception** | 404 → `ResourceNotFoundException` · 400 → `BusinessRuleException` · 409 → `ConflictException` · 500 → `TechnicalException` (luôn kèm `cause`). 401/403 để Spring Security lo. **Cấm `throw new RuntimeException`** — nó rơi xuống handler chung và trả 500. |
| **try/catch** | Chỉ dùng khi thật sự phục hồi được lỗi, hoặc khi phải trả kết quả khác JSON (ví dụ callback VNPay redirect trình duyệt). Không bọc cả method rồi ném lại — `GlobalExceptionHandler` đã lo. |
| **Logging** | Không `System.out.println`, không `e.printStackTrace()`. Dùng `@Slf4j` + `log.error("...", ex)` để giữ stack trace. |
| **Endpoint** | `/rims/<role>/<resource>`, danh từ số nhiều, kebab-case. Phân quyền khai báo tập trung ở `SecurityConfig`, không rải `@PreAuthorize`. |
| **Cấu hình** | Không hardcode URL hay secret. Dùng `@Value("${app.xxx}")` và khai báo trong `application.yaml`. |

## Frontend (React / TypeScript)

| Chủ đề | Quy tắc |
|---|---|
| **Component** | Page → `export default function XxxPage()`. Component tái dùng → `export function Xxx()`. Một component một file. > 500 dòng phải tách sang `features/<x>/<tên>/`. |
| **Gọi API** | Chỉ qua `shared/api/*`. Cấm `fetch()` và `axios` trực tiếp trong component. Module API chỉ export **hàm rời**, không export object gộp (object chặn tree-shaking). Nơi gọi dùng `import * as xxxApi from '...'`. |
| **Huỷ request** | Mỗi hàm API nhận thêm `signal?: AbortSignal`; effect tạo `AbortController` và `abort()` khi unmount. |
| **Lỗi** | Luôn `getErrorMessage(error, 'thông báo dự phòng')` từ `@/shared/utils/error`. **Cấm tự viết hàm bóc lỗi mới** — đã từng có 28 bản copy. |
| **Loading / empty / error** | Dùng `LoadingState`, `EmptyState`, `ErrorState`. Không tự viết `{loading && <div>Đang tải...</div>}`. |
| **Import** | Cross-feature dùng alias `@/`. Cùng thư mục dùng `./`. Không bao giờ `../../..`. |
| **Style** | Class CSS trong `styles/bootstrap-rims-<area>.css`, tên `<area>-<block>-<element>`. Màu lấy từ biến trong `tokens.css`. `style={{}}` chỉ cho giá trị tính động lúc runtime. |
| **console** | `console.error` / `console.warn` được phép để ghi lỗi request. `console.log` thì không — ESLint sẽ cảnh báo. |

## Chung

| Chủ đề | Quy tắc |
|---|---|
| **Comment** | Tiếng Việt, giải thích **vì sao** chứ không mô tả lại code. Không comment code chết — xoá đi, git nhớ hộ rồi. |
| **Commit** | `<type>: <mô tả>` với type ∈ `feat fix refactor style docs test chore`. Không đặt tên kiểu `inter1`, `img part 5`, `fixx`, `promax`. |
| **Commit reformat** | **Không bao giờ trộn reformat với sửa logic.** Commit `style:` chỉ chứa thay đổi format, và hash phải ghi vào `.git-blame-ignore-revs`. Trộn lẫn sẽ gán nhầm công của người khác sang tên mình. |
| **Di chuyển code** | Khi gộp hoặc tách file: commit riêng, **không đổi một ký tự nào** trong lúc di chuyển. Sửa logic ở commit sau. Ghi rõ file nguồn trong commit message. |
| **Secret** | Không commit. Điền vào `application-local.yaml` (đã gitignore) hoặc biến môi trường. Xem `application-local.yaml.example`. |
