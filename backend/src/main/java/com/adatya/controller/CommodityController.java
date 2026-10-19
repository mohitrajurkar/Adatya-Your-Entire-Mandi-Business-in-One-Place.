package com.adatya.controller;

import com.adatya.model.Commodity;
import com.adatya.repository.CommodityRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/commodities")
public class CommodityController {

    private final CommodityRepository commodityRepository;

    public CommodityController(CommodityRepository commodityRepository) {
        this.commodityRepository = commodityRepository;
    }

    @GetMapping
    public ResponseEntity<List<Commodity>> getAllCommodities() {
        return ResponseEntity.ok(commodityRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<Commodity> createCommodity(@RequestBody Commodity commodity) {
        Commodity saved = commodityRepository.save(commodity);
        return ResponseEntity.ok(saved);
    }
}
