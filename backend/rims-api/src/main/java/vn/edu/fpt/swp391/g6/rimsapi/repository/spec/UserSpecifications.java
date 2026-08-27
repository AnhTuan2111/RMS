package vn.edu.fpt.swp391.g6.rimsapi.repository.spec;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.jpa.domain.Specification;

import vn.edu.fpt.swp391.g6.rimsapi.entity.User;
import vn.edu.fpt.swp391.g6.rimsapi.enums.RoleType;

/**
 * Xây dựng các Specification để lọc User (staff / customer) phục vụ
 * cho các API danh sách có phân trang, tìm kiếm và lọc trạng thái.
 */
public final class UserSpecifications
{
    private UserSpecifications()
    {
    }

    public static Specification<User> roleIn(List<RoleType> roles)
    {
        return (root, query, cb) -> root.get("role").in(roles);
    }

    public static Specification<User> roleEquals(RoleType role)
    {
        return (root, query, cb) -> cb.equal(root.get("role"), role);
    }

    public static Specification<User> roleNotEquals(RoleType role)
    {
        return (root, query, cb) -> cb.notEqual(root.get("role"), role);
    }

    public static Specification<User> isActive(Boolean active)
    {
        return (root, query, cb) -> cb.equal(root.get("isActive"), active);
    }

    /**
     * Tìm theo từ khóa trên các trường: họ tên, tên đăng nhập, email, số điện thoại.
     * Không phân biệt hoa thường.
     */
    public static Specification<User> keyword(String keyword)
    {
        String like = "%" + keyword.trim().toLowerCase() + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("fullName")), like),
                cb.like(cb.lower(root.get("username")), like),
                cb.like(cb.lower(cb.coalesce(root.get("email"), "")), like),
                cb.like(root.get("phone"), like));
    }

    /**
     * Gộp các điều kiện lọc phổ biến: role, keyword tìm kiếm, trạng thái hoạt động.
     * Bất kỳ tham số nào null/rỗng sẽ được bỏ qua (không áp dụng điều kiện đó).
     */
    public static Specification<User> filter(
            List<RoleType> rolesIn,
            RoleType roleExclude,
            String keyword,
            Boolean active)
    {
        List<Specification<User>> specs = new ArrayList<>();

        if (rolesIn != null && !rolesIn.isEmpty())
        {
            specs.add(roleIn(rolesIn));
        }
        if (roleExclude != null)
        {
            specs.add(roleNotEquals(roleExclude));
        }
        if (keyword != null && !keyword.isBlank())
        {
            specs.add(keyword(keyword));
        }
        if (active != null)
        {
            specs.add(isActive(active));
        }

        return combine(specs);
    }

    private static Specification<User> combine(List<Specification<User>> specs)
    {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            for (Specification<User> spec : specs)
            {
                predicates.add(spec.toPredicate(root, query, cb));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
