package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import java.security.SecureRandom;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.auth.UpdateProfileRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.user.*;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.common.PageResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserProfileResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserResponse;
import vn.edu.fpt.swp391.g6.rimsapi.entity.User;
import vn.edu.fpt.swp391.g6.rimsapi.enums.RoleType;
import vn.edu.fpt.swp391.g6.rimsapi.repository.UserRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.spec.UserSpecifications;
import vn.edu.fpt.swp391.g6.rimsapi.security.UserPrincipal;
import vn.edu.fpt.swp391.g6.rimsapi.service.EmailService;
import vn.edu.fpt.swp391.g6.rimsapi.service.UserService;
import vn.edu.fpt.swp391.g6.rimsapi.util.OtpStore;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService
{

    private static final List<RoleType> ASSIGNABLE_STAFF_ROLES = List.of(
            RoleType.CHEF, RoleType.WAITER, RoleType.CASHIER);

    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_SIZE = 10;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final OtpStore otpStore;

    private static final String DEFAULT_PASSWORD = "123456";

    // ===================== EXISTING =====================
    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers()
    {
        return userRepository.findAll().stream()
                .map(this::convertToResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(Integer id)
    {
        User user = findUserById(id);
        return toUserProfile(user);
    }

    @Override
    @Transactional
    public UserProfileResponse updateProfile(Integer id, UpdateProfileRequest request)
    {
        User user = findUserById(id);

        if (!user.getPhone().equals(request.getPhone())
                && userRepository.existsByPhone(request.getPhone()))
        {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Số điện thoại đã được sử dụng");
        }
        if (request.getEmail() != null
                && !request.getEmail().equals(user.getEmail())
                && userRepository.existsByEmail(request.getEmail()))
        {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        }

        user.setFullName(request.getFullName());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        userRepository.save(user);
        return toUserProfile(user);
    }

    // ===================== NEW =====================

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getStaffAccounts(String keyword, Boolean active, int page, int size)
    {
        // Danh sách "nhân viên" hiển thị cho admin không bao gồm chính tài khoản ADMIN
        var spec = UserSpecifications.filter(ASSIGNABLE_STAFF_ROLES, null, keyword, active);
        Pageable pageable = buildPageable(page, size);
        Page<User> result = userRepository.findAll(spec, pageable);
        return PageResponse.from(result.map(this::convertToResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getCustomerAccounts(String keyword, Boolean active, int page, int size)
    {
        var spec = UserSpecifications.filter(List.of(RoleType.CUSTOMER), null, keyword, active);
        Pageable pageable = buildPageable(page, size);
        Page<User> result = userRepository.findAll(spec, pageable);
        return PageResponse.from(result.map(this::convertToResponse));
    }

    private Pageable buildPageable(int page, int size)
    {
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        return PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    @Override
    @Transactional
    public UserResponse createStaff(CreateStaffRequest request)
    {
        if (request.getRole() == RoleType.CUSTOMER)
        {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể tạo nhân viên với vai trò CUSTOMER");
        }
        validateUniqueFields(request.getUsername(), request.getEmail(), request.getPhone());

        User user = new User();
        user.setUsername(request.getUsername());
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setRole(request.getRole());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setActive(true);

        return convertToResponse(userRepository.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getAccountDetail(Integer id)
    {
        return convertToResponse(findUserById(id));
    }

    @Override
    @Transactional
    public UserResponse updateAccount(Integer id, UpdateAccountRequest request)
    {
        User user = findUserById(id);

        if (!user.getUsername().equals(request.getUsername())
                && userRepository.findByUsername(request.getUsername()).isPresent())
        {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên đăng nhập đã được sử dụng");
        }
        if (!user.getPhone().equals(request.getPhone())
                && userRepository.existsByPhone(request.getPhone()))
        {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Số điện thoại đã được sử dụng");
        }
        if (request.getEmail() != null
                && !request.getEmail().equals(user.getEmail())
                && userRepository.existsByEmail(request.getEmail()))
        {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
        }

        user.setUsername(request.getUsername());
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());

        // Cập nhật role — chỉ cho phép với staff không phải Admin
        if (request.getRole() != null)
        {
            if (user.getRole() == RoleType.ADMIN)
            {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Không thể thay đổi vai trò của tài khoản Admin");
            }
            if (user.getRole() == RoleType.CUSTOMER)
            {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Không thể thay đổi vai trò của tài khoản khách hàng");
            }
            if (!ASSIGNABLE_STAFF_ROLES.contains(request.getRole()))
            {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Vai trò không hợp lệ. Chỉ được chọn: CHEF, WAITER, CASHIER");
            }
            user.setRole(request.getRole());
        }

        return convertToResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public void setAccountStatus(Integer id, SetAccountStatusRequest request)
    {
        User user = findUserById(id);
        if (user.getRole() == RoleType.ADMIN)
        {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không thể khóa tài khoản Admin");
        }
        user.setActive(request.isActive());
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void changePassword(UserPrincipal principal, ChangePasswordRequest request)
    {
        User user = findUserById(principal.getId());
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash()))
        {
            throw new BadCredentialsException("Mật khẩu hiện tại không đúng");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void sendForgotPasswordOtp(ForgotPasswordRequest request)
    {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Email không tồn tại"));

        if (user.getRole() != RoleType.CUSTOMER)
        {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chức năng quên mật khẩu chỉ dành cho khách hàng");
        }

        String otp = generateOtp();
        otpStore.save(request.getEmail(), otp);
        emailService.sendOtp(request.getEmail(), otp);
    }

    @Override
    @Transactional
    public void verifyOtpAndResetPassword(VerifyOtpRequest request)
    {
        if (!otpStore.verify(request.getEmail(), request.getOtp()))
        {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP không hợp lệ hoặc đã hết hạn");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Email không tồn tại"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        otpStore.remove(request.getEmail());
    }

    @Override
    @Transactional
    public UserResponse register(CreateCustomerRequest request)
    {
        validateUniqueFields(request.getUsername(), request.getEmail(), request.getPhone());

        User user = new User();
        user.setRole(RoleType.CUSTOMER);
        user.setUsername(request.getUsername());
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setPasswordHash(passwordEncoder.encode("123456"));
        user.setActive(true);

        User saved = userRepository.save(user);
        return convertToResponse(saved);
    }

    @Override
    @Transactional
    public UserResponse createCustomer(CreateCustomerRequest request)
    {
        validateUniqueFields(request.getUsername(), request.getEmail(), request.getPhone());

        User user = new User();
        user.setUsername(request.getUsername());
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setRole(RoleType.CUSTOMER);
        user.setPasswordHash(passwordEncoder.encode(DEFAULT_PASSWORD));
        user.setActive(true);

        return convertToResponse(userRepository.save(user));
    }

    // ===================== HELPERS =====================

    private User findUserById(Integer id)
    {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại"));
    }

    private void validateUniqueFields(String username, String email, String phone)
    {
        userRepository.findByUsername(username).ifPresent(u -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên đăng nhập đã được sử dụng");
        });

        if (email != null)
        {
            userRepository.findByEmail(email).ifPresent(u -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng");
            });
        }

        userRepository.findByPhone(phone).ifPresent(u -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Số điện thoại đã được sử dụng");
        });
    }

    private String generateOtp()
    {
        SecureRandom random = new SecureRandom();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    private UserProfileResponse toUserProfile(User user)
    {
        return UserProfileResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .email(user.getEmail())
                .role(user.getRole())
                .rewardPoints(user.getRewardPoints())
                .build();
    }

    private UserResponse convertToResponse(User user)
    {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .rewardPoints(user.getRewardPoints())
                .role(user.getRole())
                .isActive(user.isActive())
                .rewardPoints(user.getRewardPoints())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
