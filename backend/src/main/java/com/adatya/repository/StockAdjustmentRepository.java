package com.adatya.repository;

import com.adatya.model.StockAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, Long> {
    List<StockAdjustment> findAllByOrderByCreatedAtDesc();
    List<StockAdjustment> findAllByUserId(Long userId);
    void deleteAllByUserId(Long userId);
    List<StockAdjustment> findAllByUserIdOrderByCreatedAtDesc(Long userId);
    List<StockAdjustment> findAllByUserIdOrUserIdIsNull(Long userId);
    long countByUserId(Long userId);
}
