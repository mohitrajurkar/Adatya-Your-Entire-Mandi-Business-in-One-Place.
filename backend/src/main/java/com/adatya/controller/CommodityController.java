package com.adatya.controller;

import com.adatya.domain.Money;
import com.adatya.dto.TradeRequests.SaveCommodity;
import com.adatya.model.Commodity;
import com.adatya.repository.CommodityRepository;
import com.adatya.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/commodities")
public class CommodityController {

    private final CommodityRepository commodityRepository;
    private final CurrentUser currentUser;

    public CommodityController(CommodityRepository commodityRepository, CurrentUser currentUser) {
        this.commodityRepository = commodityRepository;
        this.currentUser = currentUser;
    }

    @GetMapping
    public ResponseEntity<List<Commodity>> getAllCommodities() {
        return ResponseEntity.ok(commodityRepository.findAllByUserId(currentUser.id()));
    }

    @PostMapping
    public ResponseEntity<?> createCommodity(@Valid @RequestBody SaveCommodity request) {
        Long userId = currentUser.id();
        String name = request.name().trim();

        // Reuse rather than duplicate, so stock is not split across two rows
        // spelled the same way.
        Optional<Commodity> existing = commodityRepository.findByNameAndUserId(name, userId);
        if (existing.isPresent()) {
            Commodity found = existing.get();
            found.setDefaultRate(Money.scaleMoney(request.defaultRate()));
            return ResponseEntity.ok(commodityRepository.save(found));
        }

        return ResponseEntity.ok(commodityRepository.save(
                new Commodity(userId, name, Money.scaleMoney(request.defaultRate()))));
    }
}
