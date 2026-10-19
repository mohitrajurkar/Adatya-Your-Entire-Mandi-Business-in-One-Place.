package com.adatya.controller;

import com.adatya.security.CurrentUser;
import com.adatya.service.InventoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Stock positions. The calculation moved into InventoryService, where it is
 * done in exact decimal arithmetic rather than accumulated doubles.
 */
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final CurrentUser currentUser;

    public InventoryController(InventoryService inventoryService, CurrentUser currentUser) {
        this.inventoryService = inventoryService;
        this.currentUser = currentUser;
    }

    @GetMapping("/stock")
    public ResponseEntity<Map<String, Object>> getStock() {
        return ResponseEntity.ok(inventoryService.stockReport(currentUser.id()));
    }
}
