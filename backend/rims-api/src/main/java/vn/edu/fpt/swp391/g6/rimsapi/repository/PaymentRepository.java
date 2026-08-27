package vn.edu.fpt.swp391.g6.rimsapi.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import vn.edu.fpt.swp391.g6.rimsapi.entity.Payment;

public interface PaymentRepository extends JpaRepository<Payment, Long>
{
}
