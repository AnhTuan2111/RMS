package vn.edu.fpt.swp391.g6.rimsapi.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

import vn.edu.fpt.swp391.g6.rimsapi.enums.RoleType;

@Getter
@AllArgsConstructor
public class UserPrincipal
{
    //class này đại diện cho người dùng đang đăng nhập
    //chỉ phục vụ cho authen và authoriz. chỉ chứa dữ liệu tối giản và cần thiết nhất
    //tiện lợi để lưu thông tin trong SecurityContext (truy cập thông tin nhanh mà không cần phải truy vấn DB)
    private final Integer id;
    private final String username;
    private final RoleType role;

    //đơn giản mà nói: đây là dto dành riêng cho Sercurity
    //là cầu nối giữa jwt/SecurityContext và Controller/Service
}
