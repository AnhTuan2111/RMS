package vn.edu.fpt.swp391.g6.rimsapi.dto.response.user;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import vn.edu.fpt.swp391.g6.rimsapi.enums.RoleType;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse
{
    private Integer id;

    private String username;

    private String fullName;

    private String email;

    private String phone;

    private Integer rewardPoints;

    private RoleType role;

    @JsonProperty("isActive")
    private boolean isActive;

    private LocalDateTime createdAt;
}
