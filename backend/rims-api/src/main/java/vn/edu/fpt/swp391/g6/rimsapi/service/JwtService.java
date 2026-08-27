package vn.edu.fpt.swp391.g6.rimsapi.service;

import com.nimbusds.jwt.JWTClaimsSet;

public interface JwtService
{
    String generateAccessToken(int id, String username, String role);

    String generateRefreshToken(int id);

    JWTClaimsSet parseAndValidate(String token);

    boolean isAccessToken(JWTClaimsSet claims);

    boolean isRefreshToken(JWTClaimsSet claims);

    Integer extractUserId(JWTClaimsSet claims);

    String extractUsername(JWTClaimsSet claims);

    String extractRole(JWTClaimsSet claims);

    String extractJti(String token);

    String extractJti(JWTClaimsSet claims);

    java.time.LocalDateTime extractExpiry(String token);
}
