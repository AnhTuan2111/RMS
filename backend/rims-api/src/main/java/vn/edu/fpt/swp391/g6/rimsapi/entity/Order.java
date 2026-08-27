package vn.edu.fpt.swp391.g6.rimsapi.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.*;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderStatus;

@Entity
@Table(name = "orders")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Order
{
    @Id
    @Column(name = "order_id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "table_id", nullable = false)
    private RestaurantTable table;

    @ManyToOne
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Column(nullable = false)
    private BigDecimal totalAmount;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<OrderItem> orderItems;

    @OneToOne(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private Invoice invoice;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private Integer pendingCustomerId;

    private Integer pendingPointsUsed;

    // ghi nhận thời điểm order chuyển sang LOCKED, dùng để tự động phát hiện
    // order bị "kẹt" LOCKED quá lâu (Cashier đóng tab/mất mạng giữa chừng thanh toán).
    // null khi order không ở trạng thái LOCKED.
    private LocalDateTime lockedAt;

    // Thêm món vào đơn hàng và tự động thiết lập liên kết ngược lại ở phía OrderItem
    public void addOrderItem(OrderItem orderItem)
    {
        if (this.orderItems == null)
        {
            this.orderItems = new java.util.ArrayList<>();
        }
        this.orderItems.add(orderItem);
        orderItem.setOrder(this); // Thiết lập mối quan hệ 2 chiều ở phía OrderItem
    }

    // Xóa món khỏi đơn hàng và gỡ bỏ liên kết ngược lại ở phía OrderItem
    public void removeOrderItem(OrderItem orderItem)
    {
        if (this.orderItems != null)
        {
            this.orderItems.remove(orderItem);
            orderItem.setOrder(null); // Gỡ bỏ mối quan hệ 2 chiều ở phía OrderItem
        }
    }

    // Gán hóa đơn cho đơn hàng và đồng bộ hóa liên kết ngược lại từ hóa đơn về đơn hàng này
    public void setInvoice(Invoice invoice)
    {
        this.invoice = invoice;
        if (invoice != null && invoice.getOrder() != this)
        {
            invoice.setOrder(this); // Thiết lập liên kết ngược lại ở phía Invoice (tránh vòng lặp vô hạn)
        }
    }
}
