package com.adatya.controller;

import com.adatya.security.CurrentUser;
import com.adatya.model.Farmer;
import com.adatya.repository.FarmerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/farmers")
public class FarmerController {

    private final FarmerRepository farmerRepository;
    private final CurrentUser currentUser;

    public FarmerController(FarmerRepository farmerRepository, CurrentUser currentUser) {
        this.farmerRepository = farmerRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<List<Farmer>> getAllFarmers() {
        Long userId = currentUser.id();
        return ResponseEntity.ok(farmerRepository.findAllByUserId(userId));
    }

    @PostMapping
    public ResponseEntity<Farmer> createFarmer(@RequestBody Farmer farmer) {
        Long userId = currentUser.id();
        farmer.setUserId(userId);
        if (farmer.getOutstandingBalance() == null) {
            farmer.setOutstandingBalance(0.0);
        }
        Farmer saved = farmerRepository.save(farmer);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Farmer> updateFarmer(@PathVariable Long id, @RequestBody Farmer payload) {
        Long userId = currentUser.id();
        Optional<Farmer> farmerOpt = farmerRepository.findByIdAndUserId(id, userId);
        if (farmerOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Farmer existing = farmerOpt.get();
        if (payload.getName() != null) existing.setName(payload.getName());
        if (payload.getVillage() != null) existing.setVillage(payload.getVillage());
        if (payload.getMobile() != null) existing.setMobile(payload.getMobile());
        if (payload.getOutstandingBalance() != null) existing.setOutstandingBalance(payload.getOutstandingBalance());
        return ResponseEntity.ok(farmerRepository.save(existing));
    }
}
