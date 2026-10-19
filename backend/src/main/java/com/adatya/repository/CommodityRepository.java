package com.adatya.repository;

import com.adatya.model.Commodity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommodityRepository extends JpaRepository<Commodity, Long> {
    List<Commodity> findAllByUserId(Long userId);
    List<Commodity> findAllByUserIdOrUserIdIsNull(Long userId);
    Optional<Commodity> findByNameAndUserId(String name, Long userId);
    long countByUserId(Long userId);
}
