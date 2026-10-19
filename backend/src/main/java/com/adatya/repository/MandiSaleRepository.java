package com.adatya.repository;

import com.adatya.model.MandiSale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MandiSaleRepository extends JpaRepository<MandiSale, Long> {
    List<MandiSale> findAllByOrderByCreatedAtDesc();
    List<MandiSale> findAllByUserIdOrderByCreatedAtDesc(Long userId);
    List<MandiSale> findAllByUserIdOrUserIdIsNullOrderByCreatedAtDesc(Long userId);
    long countByUserId(Long userId);
    Optional<MandiSale> findByIdAndUserId(Long id, Long userId);
}
