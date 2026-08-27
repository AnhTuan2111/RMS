package vn.edu.fpt.swp391.g6.rimsapi.repository;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import vn.edu.fpt.swp391.g6.rimsapi.entity.RestaurantTable;
import vn.edu.fpt.swp391.g6.rimsapi.enums.TableStatus;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Integer>
{
    // Tìm các bàn trống có sức chứa >= minCapacity, dùng để chuyển reservation sang bàn mới
    List<RestaurantTable> findByStatusAndCapacityGreaterThanEqual(TableStatus status, int minCapacity);

    // Lock bàn để tránh 2 request cùng đặt 1 bàn tại cùng thời điểm (race condition)
    // Request thứ 2 sẽ phải CHỜ cho tới khi transaction của request thứ 1 commit/rollback
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM RestaurantTable t WHERE t.id = :id")
    Optional<RestaurantTable> findByIdForUpdate(@Param("id") Integer id);
}
