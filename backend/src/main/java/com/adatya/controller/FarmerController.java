package com.adatya.controller;

import com.adatya.config.UserContextHelper;
import com.adatya.model.Farmer;
import com.adatya.repository.FarmerRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/farmers")
public class FarmerController {

    private final FarmerRepository farmerRepository;
    private final UserContextHelper userContextHelper;

    public FarmerController(FarmerRepository farmerRepository, UserContextHelper userContextHelper) {
        this.farmerRepository = farmerRepository;
        this.userContextHelper = userContextHelper;
    }

    @GetMapping
    public ResponseEntity<List<Farmer>> getAllFarmers(HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
        return ResponseEntity.ok(farmerRepository.findAllByUserId(userId));
    }

    @PostMapping
    public ResponseEntity<Farmer> createFarmer(@RequestBody Farmer farmer, HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
        farmer.setUserId(userId);
        if (farmer.getOutstandingBalance() == null) {
            farmer.setOutstandingBalance(0.0);
        }
        Farmer saved = farmerRepository.save(farmer);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Farmer> updateFarmer(@PathVariable Long id, @RequestBody Farmer payload, HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
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
