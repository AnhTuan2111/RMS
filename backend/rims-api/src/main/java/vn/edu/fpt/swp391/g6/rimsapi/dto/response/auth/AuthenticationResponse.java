package vn.edu.fpt.swp391.g6.rimsapi.dto.response.auth;

import lombok.*;
import vn.edu.fpt.swp391.g6.rimsapi.enums.RoleType;


@Getter
@Builder
@ToString
@AllArgsConstructor
@NoArgsConstructor
public class AuthenticationResponse
{
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private long expiresIn;
    private boolean authenticated;
    private Integer userId;
    private String username;
    private String fullName;
    private String phone;
    private String email;
    private RoleType role;
    private Integer rewardPoints;
}
