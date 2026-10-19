package com.adatya.repository;

import com.adatya.model.BusinessProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BusinessProfileRepository extends JpaRepository<BusinessProfile, Long> {
    Optional<BusinessProfile> findByUserId(Long userId);
    /** The live profile for a trader. Archived rows are pre-upgrade copies. */
    Optional<BusinessProfile> findByUserIdAndArchivedFalse(Long userId);
    List<BusinessProfile> findAllByUserIdAndArchivedFalse(Long userId);
    List<BusinessProfile> findAllByUserId(Long userId);
    void deleteAllByUserId(Long userId);
}
