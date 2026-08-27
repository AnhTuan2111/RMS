package vn.edu.fpt.swp391.g6.rimsapi.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import vn.edu.fpt.swp391.g6.rimsapi.entity.Order;
import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderStatus;

public interface OrderRepository extends JpaRepository<Order, Long>
{

    List<Order> findByStatusIn(List<OrderStatus> statuses);

    List<Order> findByStatusAndInvoiceIsNullAndCreatedAtBefore(OrderStatus status, LocalDateTime cutoff);

    @Query("""
            SELECT o FROM Order o
            JOIN FETCH o.table t
            LEFT JOIN FETCH o.orderItems oi
            LEFT JOIN FETCH oi.dish d
            WHERE o.id = :orderId
            """)
    Optional<Order> findOrderWithDetailsById(@Param("orderId") Long orderId);

    @Query("""
            SELECT DISTINCT o FROM Order o
            JOIN FETCH o.table t
            LEFT JOIN FETCH o.orderItems oi
            LEFT JOIN FETCH oi.dish d
            WHERE o.status = SERVING
            AND t.id = :tableID
            """)
    List<Order> findServingOrdersWithDetails(@Param("tableID") int tableID);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.orderItems WHERE o.id = :id")
    Optional<Order> findOrderForUpdateWithItems(@Param("id") Long orderId);

    List<Order> findByStatusAndLockedAtBefore(OrderStatus status, LocalDateTime deadline);
}
