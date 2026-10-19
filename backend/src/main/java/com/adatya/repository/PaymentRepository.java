package com.adatya.repository;

import com.adatya.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findAllByPurchaseId(Long purchaseId);
    List<Payment> findAllByUserId(Long userId);
    void deleteAllByUserId(Long userId);
    List<Payment> findAllByUserIdOrUserIdIsNull(Long userId);
    long countByUserId(Long userId);
    void deleteAllByPurchaseId(Long purchaseId);
}
