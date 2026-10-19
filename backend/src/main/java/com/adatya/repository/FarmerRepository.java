package com.adatya.repository;

import com.adatya.model.Farmer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FarmerRepository extends JpaRepository<Farmer, Long> {
    List<Farmer> findAllByUserId(Long userId);
    void deleteAllByUserId(Long userId);
    List<Farmer> findAllByUserIdOrUserIdIsNull(Long userId);
    long countByUserId(Long userId);
    Optional<Farmer> findByIdAndUserId(Long id, Long userId);
}
