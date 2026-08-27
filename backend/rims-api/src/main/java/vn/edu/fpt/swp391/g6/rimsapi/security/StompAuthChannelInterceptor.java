package vn.edu.fpt.swp391.g6.rimsapi.security;

import java.util.Map;
import java.util.Set;

import com.nimbusds.jwt.JWTClaimsSet;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import vn.edu.fpt.swp391.g6.rimsapi.enums.RoleType;
import vn.edu.fpt.swp391.g6.rimsapi.exception.InvalidTokenException;
import vn.edu.fpt.swp391.g6.rimsapi.repository.RevokedTokenRepository;
import vn.edu.fpt.swp391.g6.rimsapi.service.JwtService;

@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor
{

    private final JwtService jwtService;
    private final RevokedTokenRepository revokedTokenRepository;

    // Danh sách đã xác minh bằng audit:
    // - /topic/kitchen  : chỉ Chef subscribe (DishListPage, GroupedKitchenPage, KitchenQueuePage)
    // - /topic/waiter   : chỉ Waiter subscribe (WaiterTableListPage, WaiterCreateOrderPage,
    //                     WaiterOrderDetailPage, WaiterUpdateOrderPage)
    // - /topic/tables   : Waiter + Cashier subscribe (WaiterTableListPage, CashierPaymentsPage)
    // - /topic/chef-note: chỉ Chef subscribe (KitchenQueuePage) -- Waiter chỉ GỬI, không NGHE
    // ADMIN được thêm vào mọi topic để phòng hờ (không có trang Admin nào subscribe hiện tại,
    // nhưng AdminServiceImpl có gửi tin vào /topic/waiter và /topic/kitchen).
    private static final Map<String, Set<String>> TOPIC_ROLES = Map.of(
            "/topic/kitchen", Set.of("CHEF", "ADMIN"),
            "/topic/waiter", Set.of("WAITER", "ADMIN"),
            "/topic/tables", Set.of("WAITER", "CASHIER", "ADMIN"),
            "/topic/chef-note", Set.of("CHEF", "ADMIN"),
            "/topic/admin", Set.of("ADMIN"));

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel)
    {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null)
        {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand()))
        {
            handleConnect(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand()))
        {
            handleSubscribe(accessor);
        }

        return message;
    }

    private void handleConnect(StompHeaderAccessor accessor)
    {
        String authHeader = accessor.getFirstNativeHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer "))
        {
            throw new AccessDeniedException("Thiếu token xác thực cho kết nối WebSocket");
        }

        String token = authHeader.substring(7);

        try
        {
            JWTClaimsSet claims = jwtService.parseAndValidate(token);

            if (!jwtService.isAccessToken(claims))
            {
                throw new AccessDeniedException("Token không hợp lệ cho WebSocket");
            }

            String jti = jwtService.extractJti(claims);
            if (jti != null && revokedTokenRepository.existsByJti(jti))
            {
                throw new AccessDeniedException("Token đã bị thu hồi");
            }

            String role = jwtService.extractRole(claims);
            Integer userId = jwtService.extractUserId(claims);
            String username = jwtService.extractUsername(claims);

            UserPrincipal principal = new UserPrincipal(userId, username, RoleType.valueOf(role));
            accessor.setUser(new StompPrincipal(principal));

            if (accessor.getSessionAttributes() != null)
            {
                accessor.getSessionAttributes().put("role", role);
            }
        } catch (InvalidTokenException e)
        {
            throw new AccessDeniedException("Token không hợp lệ hoặc đã hết hạn");
        }
    }

    private void handleSubscribe(StompHeaderAccessor accessor)
    {
        String destination = accessor.getDestination();
        if (destination == null)
        {
            return;
        }

        Set<String> allowedRoles = TOPIC_ROLES.get(destination);
        if (allowedRoles == null)
        {
            throw new AccessDeniedException("Không được phép truy cập kênh: " + destination);
        }

        Object role = accessor.getSessionAttributes() != null
                ? accessor.getSessionAttributes().get("role")
                : null;

        if (role == null || !allowedRoles.contains(role.toString()))
        {
            throw new AccessDeniedException("Vai trò hiện tại không được phép subscribe: " + destination);
        }
    }
}
