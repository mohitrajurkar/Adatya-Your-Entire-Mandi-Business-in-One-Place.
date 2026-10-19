package com.adatya.controller;

import com.adatya.domain.Money;
import com.adatya.dto.TradeRequests.SaveFarmer;
import com.adatya.model.Farmer;
import com.adatya.repository.FarmerRepository;
import com.adatya.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
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
        return ResponseEntity.ok(farmerRepository.findAllByUserId(currentUser.id()));
    }

    @PostMapping
    public ResponseEntity<Farmer> createFarmer(@Valid @RequestBody SaveFarmer request) {
        Farmer farmer = new Farmer();
        farmer.setUserId(currentUser.id());
        farmer.setName(request.name().trim());
        farmer.setVillage(request.village());
        farmer.setMobile(request.mobile());
        // The balance is derived from the ledger, never supplied by the client.
        farmer.setOutstandingBalance(Money.ZERO_MONEY);
        farmer.setCreatedAt(LocalDateTime.now());
        return ResponseEntity.ok(farmerRepository.save(farmer));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Farmer> updateFarmer(@PathVariable Long id, @Valid @RequestBody SaveFarmer request) {
        Optional<Farmer> found = farmerRepository.findByIdAndUserId(id, currentUser.id());
        if (found.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Farmer farmer = found.get();
        farmer.setName(request.name().trim());
        if (request.village() != null) farmer.setVillage(request.village());
        if (request.mobile() != null) farmer.setMobile(request.mobile());
        // outstandingBalance is deliberately not editable here: it used to be
        // writable straight from the request body, which let the ledger be
        // overwritten with any figure.
        return ResponseEntity.ok(farmerRepository.save(farmer));
    }
}
