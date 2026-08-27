package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import java.text.ParseException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import vn.edu.fpt.swp391.g6.rimsapi.exception.InvalidTokenException;
import vn.edu.fpt.swp391.g6.rimsapi.exception.TechnicalException;
import vn.edu.fpt.swp391.g6.rimsapi.service.JwtService;

@Service
public class JwtServiceImpl implements JwtService
{
    private static final String ISSUER = "RIMS";
    private static final String CLAIM_TYPE = "type";
    private static final String CLAIM_USERNAME = "username";
    private static final String CLAIM_ROLE = "role";
    private static final String TOKEN_TYPE_ACCESS = "ACCESS";
    private static final String TOKEN_TYPE_REFRESH = "REFRESH";

    @Value("${jwt.signerKey}")
    @NonFinal
    protected String signerKey;

    @Override
    public String generateAccessToken(int id, String username, String role)
    {
        try
        {
            JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                    .subject(String.valueOf(id))
                    .claim(CLAIM_USERNAME, username)
                    .claim(CLAIM_ROLE, role)
                    .claim(CLAIM_TYPE, TOKEN_TYPE_ACCESS)
                    .jwtID(UUID.randomUUID().toString())
                    .issuer(ISSUER)
                    .issueTime(new Date())
                    .expirationTime(Date.from(Instant.now().plus(15, ChronoUnit.MINUTES)))
                    .build();

            return signClaims(claimsSet);
        } catch (JOSEException e)
        {
            throw new TechnicalException("Không thể tạo access token", e);
        }
    }

    @Override
    public String generateRefreshToken(int id)
    {
        try
        {
            JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                    .subject(String.valueOf(id))
                    .claim(CLAIM_TYPE, TOKEN_TYPE_REFRESH)
                    .jwtID(UUID.randomUUID().toString())
                    .issuer(ISSUER)
                    .issueTime(new Date())
                    .expirationTime(Date.from(Instant.now().plus(7, ChronoUnit.DAYS)))
                    .build();

            return signClaims(claimsSet);
        } catch (JOSEException e)
        {
            throw new TechnicalException("Không thể tạo refresh token", e);
        }
    }

    @Override
    public JWTClaimsSet parseAndValidate(String token)
    {
        try
        {
            JWSObject jwsObject = JWSObject.parse(token);
            if (!jwsObject.verify(new MACVerifier(signerKey.getBytes())))
            {
                throw new InvalidTokenException("Chữ ký token không hợp lệ");
            }

            JWTClaimsSet claims = JWTClaimsSet.parse(jwsObject.getPayload().toJSONObject());

            if (!ISSUER.equals(claims.getIssuer()))
            {
                throw new InvalidTokenException("Nguồn phát hành token không hợp lệ");
            }

            Date expiration = claims.getExpirationTime();
            if (expiration == null || expiration.before(new Date()))
            {
                throw new InvalidTokenException("Token đã hết hạn");
            }

            return claims;
        } catch (ParseException | JOSEException e)
        {
            throw new InvalidTokenException("Token không hợp lệ");
        }
    }

    @Override
    public boolean isAccessToken(JWTClaimsSet claims)
    {
        return TOKEN_TYPE_ACCESS.equals(claims.getClaim(CLAIM_TYPE));
    }

    @Override
    public boolean isRefreshToken(JWTClaimsSet claims)
    {
        return TOKEN_TYPE_REFRESH.equals(claims.getClaim(CLAIM_TYPE));
    }

    @Override
    public Integer extractUserId(JWTClaimsSet claims)
    {
        return Integer.valueOf(claims.getSubject());
    }

    @Override
    public String extractUsername(JWTClaimsSet claims)
    {
        try
        {
            return claims.getStringClaim(CLAIM_USERNAME);
        } catch (ParseException e)
        {
            // Token không parse được nghĩa là client gửi token hỏng -> 401, không phải 500.
            throw new InvalidTokenException("Token không hợp lệ");
        }
    }

    @Override
    public String extractRole(JWTClaimsSet claims)
    {
        try
        {
            return claims.getStringClaim(CLAIM_ROLE);
        } catch (ParseException e)
        {
            throw new InvalidTokenException("Token không hợp lệ");
        }
    }

    private String signClaims(JWTClaimsSet claimsSet) throws JOSEException
    {
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS256);
        JWSObject jwsObject = new JWSObject(header, new Payload(claimsSet.toJSONObject()));
        jwsObject.sign(new MACSigner(signerKey.getBytes()));
        return jwsObject.serialize();
    }

    @Override
    public String extractJti(String token)
    {
        return parseAndValidate(token).getJWTID();
    }

    @Override
    public String extractJti(JWTClaimsSet claims)
    {
        return claims.getJWTID();
    }

    @Override
    public LocalDateTime extractExpiry(String token)
    {
        Date exp = parseAndValidate(token).getExpirationTime();
        if (exp == null)
            return null;
        return exp.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
    }
}
