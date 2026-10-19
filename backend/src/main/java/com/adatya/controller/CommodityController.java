package com.adatya.controller;

import com.adatya.model.Commodity;
import com.adatya.repository.CommodityRepository;
import com.adatya.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * Commodities are per-trader reference data.
 *
 * This controller previously had no tenant scoping at all: it listed every
 * commodity in the database and saved new ones with a null user_id, so one
 * trader saw and polluted another trader's commodity list.
 */
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
    public ResponseEntity<?> createCommodity(@RequestBody Commodity commodity) {
        Long userId = currentUser.id();

        String name = commodity.getName() != null ? commodity.getName().trim() : "";
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Commodity name is required");
        }

        Double rate = commodity.getDefaultRate();
        if (rate == null || rate <= 0) {
            throw new IllegalArgumentException("Default rate must be greater than zero");
        }

        // Reuse an existing commodity of the same name rather than creating a
        // duplicate that would split this trader's stock across two rows.
        Optional<Commodity> existing = commodityRepository.findByNameAndUserId(name, userId);
        if (existing.isPresent()) {
            Commodity found = existing.get();
            found.setDefaultRate(rate);
            return ResponseEntity.ok(commodityRepository.save(found));
        }

        // The tenant is taken from the token, never from the request body.
        Commodity saved = commodityRepository.save(new Commodity(userId, name, rate));
        return ResponseEntity.ok(saved);
    }
}
