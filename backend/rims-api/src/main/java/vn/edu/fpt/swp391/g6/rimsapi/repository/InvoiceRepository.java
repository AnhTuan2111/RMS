package vn.edu.fpt.swp391.g6.rimsapi.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Invoice;
import vn.edu.fpt.swp391.g6.rimsapi.enums.PaymentMethod;
import vn.edu.fpt.swp391.g6.rimsapi.repository.projection.BestSellingDishProjection;
import vn.edu.fpt.swp391.g6.rimsapi.repository.projection.DailyRevenueProjection;
import vn.edu.fpt.swp391.g6.rimsapi.repository.projection.InvoiceHistoryProjection;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;


@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long>
{
    //Get total Revenue
    @Query("""
            SELECT COALESCE(SUM(i.restaurantRevenueAmount),0)
            FROM Invoice i
            """)
    BigDecimal getTotalRevenue();

    //Get revenue according period
    @Query("""
            SELECT COALESCE(SUM(i.restaurantRevenueAmount),0)
            FROM Invoice i
            WHERE i.invoiceDate BETWEEN :startDate AND :endDate
            """)
    BigDecimal getRevenueBetween(
            LocalDateTime startDate,
            LocalDateTime endDate
    );

    @Query(
            value = """
                    SELECT
                        CAST(i.invoice_date AS date) AS revenueDate,
                        COALESCE(SUM(i.restaurant_revenue_amount), 0) AS revenue
                    FROM invoices i
                    WHERE i.invoice_date BETWEEN :startDate AND :endDate
                    GROUP BY CAST(i.invoice_date AS date)
                    ORDER BY CAST(i.invoice_date AS date)
                    """,
            nativeQuery = true
    )
    List<DailyRevenueProjection> getDailyRevenueBetween(
            LocalDateTime startDate,
            LocalDateTime endDate
    );

    //Best selling.
    @Query("""
            SELECT
                d.name as dishName,
                d.imageUrl as imageUrl,
                SUM(oi.quantity) as totalQuantity,
                SUM(oi.subTotal) as totalRevenue
            FROM Invoice i
            JOIN i.order o
            JOIN o.orderItems oi
            JOIN oi.dish d
            WHERE
                i.invoiceDate BETWEEN :startDate AND :endDate
                AND (:categoryId IS NULL OR d.category.id = :categoryId)
            GROUP BY
                d.id,
                d.name,
                d.imageUrl
            ORDER BY
                SUM(oi.quantity) DESC,
                SUM(oi.subTotal) DESC
            """)
    List<BestSellingDishProjection> getBestSellingDishes(
            LocalDateTime startDate,
            LocalDateTime endDate,
            Integer categoryId,
            Pageable pageable
    );

    @Query("""
            SELECT o.createdAt
            FROM Invoice i
            JOIN i.order o
            WHERE o.createdAt BETWEEN :startDate AND :endDate
            """)
    List<LocalDateTime> getPaidOrderCreatedTimesBetween(
            LocalDateTime startDate,
            LocalDateTime endDate
    );


    //Get invoice history, có filter theo bàn / phương thức / mã HĐ / tên-SĐT khách hàng.
    @Query(
            value = """
                    SELECT
                        i.id as invoiceId,
                        o.id as orderId,
                        t.tableNumber as tableNumber,
                        p.paymentMethod as paymentMethod,
                        i.finalAmount as amount,
                        i.invoiceDate as paymentDate
                    FROM Invoice i
                    JOIN i.order o
                    JOIN o.table t
                    JOIN i.payments p
                    LEFT JOIN User u ON u.id = o.pendingCustomerId
                    WHERE (:tableNumber IS NULL OR LOWER(t.tableNumber) LIKE LOWER(CONCAT('%', :tableNumber, '%')))
                      AND (:paymentMethod IS NULL OR p.paymentMethod = :paymentMethod)
                      AND (:keyword IS NULL OR CAST(i.id AS string) LIKE CONCAT('%', :keyword, '%'))
                      AND (:customerKeyword IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :customerKeyword, '%')) OR u.phone LIKE CONCAT('%', :customerKeyword, '%'))
                    ORDER BY i.invoiceDate DESC
                    """,
            countQuery = """
                    SELECT COUNT(i)
                    FROM Invoice i
                    JOIN i.order o
                    JOIN o.table t
                    JOIN i.payments p
                    LEFT JOIN User u ON u.id = o.pendingCustomerId
                    WHERE (:tableNumber IS NULL OR LOWER(t.tableNumber) LIKE LOWER(CONCAT('%', :tableNumber, '%')))
                      AND (:paymentMethod IS NULL OR p.paymentMethod = :paymentMethod)
                      AND (:keyword IS NULL OR CAST(i.id AS string) LIKE CONCAT('%', :keyword, '%'))
                      AND (:customerKeyword IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :customerKeyword, '%')) OR u.phone LIKE CONCAT('%', :customerKeyword, '%'))
                    """
    )
    Page<InvoiceHistoryProjection> getInvoiceHistory(
            @Param("tableNumber") String tableNumber,
            @Param("paymentMethod") PaymentMethod paymentMethod,
            @Param("keyword") String keyword,
            @Param("customerKeyword") String customerKeyword,
            Pageable pageable
    );


    @EntityGraph(attributePaths = {"order", "order.orderItems", "order.orderItems.dish", "order.table"})
    Optional<Invoice> findWithOrderAndItemsById(Long id);

    List<Invoice> findByRestaurantRevenueAmountIsNull();

    List<Invoice> findByInvoiceDateBetween(LocalDateTime start, LocalDateTime end);
}
