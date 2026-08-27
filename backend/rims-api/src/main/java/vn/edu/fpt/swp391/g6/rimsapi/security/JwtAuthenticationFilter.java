package vn.edu.fpt.swp391.g6.rimsapi.security;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import com.nimbusds.jwt.JWTClaimsSet;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import vn.edu.fpt.swp391.g6.rimsapi.enums.RoleType;
import vn.edu.fpt.swp391.g6.rimsapi.repository.RevokedTokenRepository;
import vn.edu.fpt.swp391.g6.rimsapi.service.JwtService;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter
{
    private final JwtService jwtService;
    private final RevokedTokenRepository revokedTokenRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException
    {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer "))
        {
            String token = authHeader.substring(7);

            try
            {
                JWTClaimsSet claims = jwtService.parseAndValidate(token);

                String jti = jwtService.extractJti(claims);
                if (jti != null && revokedTokenRepository.existsByJti(jti))
                {
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token đã bị thu hồi");
                    return;
                }

                if (jwtService.isAccessToken(claims)
                        && SecurityContextHolder.getContext().getAuthentication() == null)
                {
                    Integer userId = jwtService.extractUserId(claims);
                    String username = jwtService.extractUsername(claims);
                    String role = jwtService.extractRole(claims);

                    UserPrincipal principal = new UserPrincipal(userId, username, RoleType.valueOf(role));
                    List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));

                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            principal, null, authorities);
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception ignored)
            {
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }
}
