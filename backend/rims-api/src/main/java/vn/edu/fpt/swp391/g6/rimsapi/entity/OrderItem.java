package vn.edu.fpt.swp391.g6.rimsapi.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.*;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Nationalized;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderItemStatus;

@Entity
@Table(name = "order_items")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class OrderItem
{
    @Id
    @Column(name = "order_item_id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne
    @JoinColumn(name = "dish_id", nullable = false)
    private Dish dish;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private BigDecimal subTotal;

    @Nationalized
    @Column(nullable = false, length = 50)
    private String dishNameSnapshot;

    @Nationalized
    @Column(length = 100)
    private String note;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private OrderItemStatus status;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(length = 100)
    @Nationalized
    private String cancelReason;

    private LocalDateTime cancelRequestedAt;

    @Nationalized
    @Column(length = 100)
    private String chefInternalNote;

    private LocalDateTime chefInternalNoteCreatedAt;

    private LocalDateTime chefInternalNoteAcknowledgedAt;
}
