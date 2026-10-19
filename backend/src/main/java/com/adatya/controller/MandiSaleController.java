package com.adatya.controller;

import com.adatya.config.UserContextHelper;
import com.adatya.model.Commodity;
import com.adatya.model.MandiSale;
import com.adatya.repository.CommodityRepository;
import com.adatya.repository.MandiSaleRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/mandi-sales")
public class MandiSaleController {

    private final MandiSaleRepository mandiSaleRepository;
    private final CommodityRepository commodityRepository;
    private final UserContextHelper userContextHelper;

    public MandiSaleController(MandiSaleRepository mandiSaleRepository,
                               CommodityRepository commodityRepository,
                               UserContextHelper userContextHelper) {
        this.mandiSaleRepository = mandiSaleRepository;
        this.commodityRepository = commodityRepository;
        this.userContextHelper = userContextHelper;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllSales(HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
        List<MandiSale> sales = mandiSaleRepository.findAllByUserIdOrderByCreatedAtDesc(userId);
        Map<Long, String> commodityNames = new HashMap<>();
        for (Commodity c : commodityRepository.findAllByUserId(userId)) {
            commodityNames.put(c.getId(), c.getName());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (MandiSale s : sales) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("saleNumber", s.getSaleNumber());
            map.put("date", s.getDate());
            map.put("commodityId", s.getCommodityId());
            map.put("commodityName", commodityNames.getOrDefault(s.getCommodityId(), "Grain"));
            map.put("buyerName", s.getBuyerName());
            map.put("buyerMobile", s.getBuyerMobile());
            map.put("buyerLocation", s.getBuyerLocation());
            map.put("vehicleNumber", s.getVehicleNumber());
            map.put("bags", s.getBags());
            map.put("weightQuintals", s.getWeightQuintals());
            map.put("saleRate", s.getSaleRate());
            map.put("subtotal", s.getSubtotal());
            map.put("hamali", s.getHamali());
            map.put("transport", s.getTransport());
            map.put("mandiCess", s.getMandiCess());
            map.put("netAmount", s.getNetAmount());
            map.put("paymentStatus", s.getPaymentStatus());
            map.put("paymentMode", s.getPaymentMode());
            map.put("notes", s.getNotes());
            map.put("createdAt", s.getCreatedAt());
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> createSale(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        try {
            Long userId = userContextHelper.resolveUserId(request);
            Long commodityId = Long.valueOf(body.get("commodityId").toString());
            Double weightQuintals = Double.valueOf(body.get("weightQuintals").toString());
            Double saleRate = Double.valueOf(body.get("saleRate").toString());
            String buyerName = (String) body.get("buyerName");

            if (weightQuintals <= 0 || saleRate <= 0) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Please enter valid grain, weight, and sale rate."));
            }

            if (buyerName == null || buyerName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Please specify buyer or mill name."));
            }

            int bags = body.get("bags") != null ? Integer.parseInt(body.get("bags").toString()) : 0;
            double hamali = body.get("hamali") != null ? Double.parseDouble(body.get("hamali").toString()) : 0.0;
            double transport = body.get("transport") != null ? Double.parseDouble(body.get("transport").toString()) : 0.0;
            double mandiCess = body.get("mandiCess") != null ? Double.parseDouble(body.get("mandiCess").toString()) : 0.0;

            String paymentStatus = (String) body.getOrDefault("paymentStatus", "Paid");
            String paymentMode = (String) body.getOrDefault("paymentMode", "Cash");
            String date = (String) body.getOrDefault("date", LocalDate.now().toString());

            double subtotal = Math.round(weightQuintals * saleRate * 100.0) / 100.0;
            double netAmount = Math.round((subtotal - hamali - transport - mandiCess) * 100.0) / 100.0;

            long count = mandiSaleRepository.countByUserId(userId) + 1;
            int year = LocalDate.now().getYear();
            String saleNumber = String.format("MS-%d-%03d", year, count);

            MandiSale sale = new MandiSale();
            sale.setUserId(userId);
            sale.setSaleNumber(saleNumber);
            sale.setDate(date);
            sale.setCommodityId(commodityId);
            sale.setBuyerName(buyerName.trim());
            sale.setBuyerMobile((String) body.get("buyerMobile"));
            sale.setBuyerLocation((String) body.get("buyerLocation"));
            sale.setVehicleNumber((String) body.get("vehicleNumber"));
            sale.setBags(bags);
            sale.setWeightQuintals(weightQuintals);
            sale.setSaleRate(saleRate);
            sale.setSubtotal(subtotal);
            sale.setHamali(hamali);
            sale.setTransport(transport);
            sale.setMandiCess(mandiCess);
            sale.setNetAmount(netAmount);
            sale.setPaymentStatus(paymentStatus);
            sale.setPaymentMode(paymentMode);
            sale.setNotes((String) body.get("notes"));
            sale.setCreatedAt(LocalDateTime.now());

            MandiSale saved = mandiSaleRepository.save(sale);
            return ResponseEntity.ok(Map.of("success", true, "sale", saved));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "error", "Failed to record mandi sale: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteSale(@PathVariable Long id, HttpServletRequest request) {
        Long userId = userContextHelper.resolveUserId(request);
        Optional<MandiSale> saleOpt = mandiSaleRepository.findByIdAndUserId(id, userId);
        if (saleOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("success", false, "error", "Sale not found"));
        }
        mandiSaleRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Mandi sale removed and stock restored."));
    }
}
