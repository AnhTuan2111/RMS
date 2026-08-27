package vn.edu.fpt.swp391.g6.rimsapi.service;

import java.util.List;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.auth.UpdateProfileRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.user.*;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.common.PageResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserProfileResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserResponse;
import vn.edu.fpt.swp391.g6.rimsapi.security.UserPrincipal;

public interface UserService
{

    List<UserResponse> getAllUsers();

    UserProfileResponse getProfile(Integer id);

    UserProfileResponse updateProfile(Integer id, UpdateProfileRequest request);

    /**
     * Danh sách tài khoản nhân viên (CHEF, WAITER, CASHIER) có phân trang, tìm kiếm và lọc trạng thái.
     *
     * @param keyword từ khóa tìm theo họ tên / tài khoản / email / SĐT (có thể null hoặc rỗng)
     * @param active  lọc theo trạng thái hoạt động (null = tất cả)
     * @param page    trang hiện tại, bắt đầu từ 0
     * @param size    số phần tử mỗi trang
     */
    PageResponse<UserResponse> getStaffAccounts(String keyword, Boolean active, int page, int size);

    /**
     * Danh sách tài khoản khách hàng có phân trang, tìm kiếm và lọc trạng thái.
     */
    PageResponse<UserResponse> getCustomerAccounts(String keyword, Boolean active, int page, int size);

    UserResponse createCustomer(CreateCustomerRequest request);

    UserResponse createStaff(CreateStaffRequest request);

    UserResponse getAccountDetail(Integer id);

    UserResponse updateAccount(Integer id, UpdateAccountRequest request);

    void setAccountStatus(Integer id, SetAccountStatusRequest request);

    void changePassword(UserPrincipal principal, ChangePasswordRequest request);

    void sendForgotPasswordOtp(ForgotPasswordRequest request);

    void verifyOtpAndResetPassword(VerifyOtpRequest request);

    UserResponse register(CreateCustomerRequest request);
}
