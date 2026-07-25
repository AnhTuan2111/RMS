package vn.edu.fpt.swp391.g6.rimsapi.service;

import vn.edu.fpt.swp391.g6.rimsapi.dto.request.auth.AuthenticationRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.request.auth.RefreshTokenRequest;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.auth.AuthenticationResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.auth.LogoutResponse;
import vn.edu.fpt.swp391.g6.rimsapi.dto.response.user.UserProfileResponse;
import vn.edu.fpt.swp391.g6.rimsapi.security.UserPrincipal;


public interface AuthService
{
    AuthenticationResponse login(AuthenticationRequest loginRequest);

    AuthenticationResponse refresh(RefreshTokenRequest request);

    UserProfileResponse getCurrentUser(UserPrincipal principal);

    LogoutResponse logout(UserPrincipal principal, String rawAccessToken, String rawRefreshToken);
}
