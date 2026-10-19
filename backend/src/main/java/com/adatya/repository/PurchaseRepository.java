package com.adatya.repository;

import com.adatya.model.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseRepository extends JpaRepository<Purchase, Long> {
    List<Purchase> findAllByOrderByCreatedAtDesc();
    List<Purchase> findAllByUserIdOrderByCreatedAtDesc(Long userId);
    void deleteAllByUserId(Long userId);
    List<Purchase> findAllByUserIdOrUserIdIsNullOrderByCreatedAtDesc(Long userId);
    Optional<Purchase> findByPurchaseNumber(String purchaseNumber);
    Optional<Purchase> findByPurchaseNumberAndUserId(String purchaseNumber, Long userId);
    Optional<Purchase> findByIdAndUserId(Long id, Long userId);
    /** Looks up a record by the idempotency key its client supplied. */
    Optional<Purchase> findByUserIdAndClientRequestId(Long userId, String clientRequestId);
    long countByUserId(Long userId);
}
