package com.adatya.repository;

import com.adatya.model.PurchaseItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseItemRepository extends JpaRepository<PurchaseItem, Long> {
    List<PurchaseItem> findAllByPurchaseId(Long purchaseId);
    List<PurchaseItem> findAllByUserId(Long userId);
    List<PurchaseItem> findAllByUserIdOrUserIdIsNull(Long userId);
    void deleteAllByPurchaseId(Long purchaseId);
}
