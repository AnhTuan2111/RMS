package vn.edu.fpt.swp391.g6.rimsapi.dto.response.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import vn.edu.fpt.swp391.g6.rimsapi.enums.RoleType;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse
{
    private Integer userId;
    private String username;
    private String fullName;
    private String phone;
    private String email;
    private RoleType role;
    private Integer rewardPoints;
}
