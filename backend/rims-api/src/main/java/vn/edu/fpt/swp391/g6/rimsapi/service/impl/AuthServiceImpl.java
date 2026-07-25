package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import com.nimbusds.jwt.JWTClaimsSet;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.auth.AuthenticationRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.auth.RefreshTokenRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.auth.AuthenticationResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.auth.LogoutResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserProfileResponse;
import vn.edu.fpt.swp391.g6.rimsapi.entity.RevokedToken;
import vn.edu.fpt.swp391.g6.rimsapi.entity.User;
import vn.edu.fpt.swp391.g6.rimsapi.exception.InvalidTokenException;
import vn.edu.fpt.swp391.g6.rimsapi.repository.RevokedTokenRepository;
import vn.edu.fpt.swp391.g6.rimsapi.repository.UserRepository;
import vn.edu.fpt.swp391.g6.rimsapi.security.UserPrincipal;
import vn.edu.fpt.swp391.g6.rimsapi.service.AuthService;
import vn.edu.fpt.swp391.g6.rimsapi.service.JwtService;

import java.time.LocalDateTime;


@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService
{
    private static final long ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RevokedTokenRepository revokedTokenRepository;

    @Override
    public AuthenticationResponse login(AuthenticationRequest loginRequest)
    {
        User user = userRepository.findByUsername(loginRequest.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Tên đăng nhập hoặc mật khẩu không đúng"));

        if (!user.isActive())
        {
            throw new DisabledException("Tài khoản đã bị vô hiệu hóa");
        }

        if (!passwordEncoder.matches(loginRequest.getRawPassword(), user.getPasswordHash()))
        {
            throw new BadCredentialsException("Tên đăng nhập hoặc mật khẩu không đúng");
        }

        return buildAuthenticationResponse(user);
    }

    @Override
    @Transactional
    public AuthenticationResponse refresh(RefreshTokenRequest request)
    {
        String rawRefreshToken = request.getRefreshToken();
        JWTClaimsSet claims = jwtService.parseAndValidate(rawRefreshToken);

        if (!jwtService.isRefreshToken(claims))
        {
            throw new InvalidTokenException("Refresh token không hợp lệ");
        }

        String oldJti = jwtService.extractJti(claims);
        LocalDateTime oldExpiry = jwtService.extractExpiry(rawRefreshToken);

        // Chặn refresh token cũ bị dùng lại (reuse detection):
        // nếu jti này đã nằm trong bảng revoked -> token đã được dùng để rotate trước đó
        // (hoặc đã bị logout) -> từ chối ngay, không cấp token mới
        if (oldJti == null || oldExpiry == null)
        {
            throw new InvalidTokenException("Refresh token không hợp lệ");
        }

        // Revoke token cũ NGAY LẬP TỨC, trước khi cấp token mới.
        // Nhờ "jti" là @Id (khoá chính) của RevokedToken, nếu có 2 request refresh
        // cùng dùng 1 token chạy song song, chỉ 1 request insert thành công,
        // request còn lại sẽ nhận DataIntegrityViolationException -> coi như bị từ chối.
        try
        {
            revokedTokenRepository.save(new RevokedToken(oldJti, LocalDateTime.now(), oldExpiry));
        }
        catch (org.springframework.dao.DataIntegrityViolationException ex)
        {
            throw new InvalidTokenException("Refresh token đã được sử dụng hoặc đã bị thu hồi");
        }

        Integer userId = jwtService.extractUserId(claims);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new InvalidTokenException("Không tìm thấy người dùng"));

        if (!user.isActive())
        {
            throw new DisabledException("Tài khoản đã bị vô hiệu hóa");
        }

        return buildAuthenticationResponse(user);
    }

    @Override
    public UserProfileResponse getCurrentUser(UserPrincipal principal)
    {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new BadCredentialsException("Không tìm thấy người dùng"));

        return toUserProfile(user);
    }

    @Override
    @Transactional
    public LogoutResponse logout(UserPrincipal principal, String rawAccessToken, String rawRefreshToken)
    {
        // Thu hồi access token hiện tại
        revokeToken(rawAccessToken);

        if (rawRefreshToken != null && !rawRefreshToken.isBlank())
        {
            try
            {
                JWTClaimsSet refreshClaims = jwtService.parseAndValidate(rawRefreshToken);
                Integer refreshOwnerId = jwtService.extractUserId(refreshClaims);

                // Chỉ revoke nếu refresh token thực sự thuộc về chính user đang logout
                // Tránh 1 user dùng access token hợp lệ của mình để revoke refresh token của người khác
                if (principal != null && refreshOwnerId != null && refreshOwnerId.equals(principal.getId()))
                {
                    revokeToken(rawRefreshToken);
                }
            }
            catch (Exception ex)
            {
                return LogoutResponse.builder()
                        .message("Đăng xuất thất bại do " + ex.getMessage()).build();
            }
        }

        return LogoutResponse.builder()
                .message("Đăng xuất thành công")
                .build();
    }

    /**
     * Hàm dùng chung để revoke 1 token (access hoặc refresh) bằng cách lưu jti + hạn hết
     * của nó vào bảng revoked_tokens. Bỏ qua an toàn nếu token không có jti/expiry hợp lệ
     * (vd token đã hết hạn từ trước, đã bị format sai...) thay vì ném lỗi làm fail cả request logout.
     */
    private void revokeToken(String rawToken)
    {
        try
        {
            String jti = jwtService.extractJti(rawToken);
            LocalDateTime expiry = jwtService.extractExpiry(rawToken);
            if (jti != null && expiry != null && !revokedTokenRepository.existsByJti(jti))
            {
                revokedTokenRepository.save(new RevokedToken(jti, LocalDateTime.now(), expiry));
            }
        }
        catch (Exception ex)
        {
            // Token không hợp lệ / đã hết hạn thì coi như không cần revoke nữa, không chặn luồng logout
        }
    }

    private AuthenticationResponse buildAuthenticationResponse(User user)
    {
        String accessToken = jwtService.generateAccessToken(
                user.getId(),
                user.getUsername(),
                user.getRole().name()
        );
        String refreshToken = jwtService.generateRefreshToken(user.getId());

        return AuthenticationResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(ACCESS_TOKEN_EXPIRES_IN_SECONDS)
                .authenticated(true)
                .userId(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .email(user.getEmail())
                .role(user.getRole())
                .rewardPoints(user.getRewardPoints())
                .build();
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

    @Scheduled(fixedRate = 3600000) // 1 hour
    @Transactional
    public void cleanupRevokedTokens()
    {
        revokedTokenRepository.deleteAllByExpiresAtBefore(LocalDateTime.now());
    }
}