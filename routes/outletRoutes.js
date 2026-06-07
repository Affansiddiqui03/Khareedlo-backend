// routes/outletRoutes.js
// Handles all outlet CRUD + nearest-finder
// Mounted at /api/outlets in server.js

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// ── Haversine formula (returns distance in km) ────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ══════════════════════════════════════════════════════════════
//  GET /api/outlets
//  Returns all outlets from approved brands with brand_name + logo
// ══════════════════════════════════════════════════════════════
router.get("/", (req, res) => {
  const sql = `
    SELECT
      o.outlet_id,
      o.brand_id,
      o.outlet_name,
      o.address,
      o.city,
      o.latitude,
      o.longitude,
      o.phone,
      o.timing,
      o.created_at,
      b.brand_name,
      b.logo
    FROM outlets o
    JOIN brands b ON o.brand_id = b.brand_id
    WHERE b.status = 'APPROVED'
    ORDER BY b.brand_name ASC, o.city ASC, o.outlet_name ASC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("GET /api/outlets error:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows);
  });
});

// ══════════════════════════════════════════════════════════════
//  GET /api/outlets/nearest?lat=X&lng=Y&limit=5&radius=10
//  Returns nearest outlets sorted by Haversine distance
//  Optional: radius (km) to filter, limit (default 5)
// ══════════════════════════════════════════════════════════════
router.get("/nearest", (req, res) => {
  const lat    = parseFloat(req.query.lat);
  const lng    = parseFloat(req.query.lng);
  const limit  = Math.min(parseInt(req.query.limit)  || 5,  50);
  const radius = parseFloat(req.query.radius) || 999999; // km, default = all

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: "lat and lng are required numbers" });
  }

  const sql = `
    SELECT
      o.outlet_id,
      o.brand_id,
      o.outlet_name,
      o.address,
      o.city,
      o.latitude,
      o.longitude,
      o.phone,
      o.timing,
      b.brand_name,
      b.logo
    FROM outlets o
    JOIN brands b ON o.brand_id = b.brand_id
    WHERE b.status = 'APPROVED'
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("GET /api/outlets/nearest error:", err);
      return res.status(500).json({ error: "DB error" });
    }

    // Compute distance for every outlet, filter by radius, sort, limit
    const result = rows
      .map(o => ({
        ...o,
        distance_km: parseFloat(
          haversine(lat, lng, parseFloat(o.latitude), parseFloat(o.longitude)).toFixed(2)
        ),
      }))
      .filter(o => o.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    res.json(result);
  });
});

// ══════════════════════════════════════════════════════════════
//  GET /api/outlets/brand/:brandId
//  Returns all outlets for one brand (for brand dashboard)
// ══════════════════════════════════════════════════════════════
router.get("/brand/:brandId", (req, res) => {
  db.query(
    `SELECT * FROM outlets WHERE brand_id = ? ORDER BY created_at DESC`,
    [req.params.brandId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// ══════════════════════════════════════════════════════════════
//  POST /api/outlets/add
//  Brand adds a new outlet
//  Body: { brand_id, outlet_name, address, city, latitude, longitude, phone, timing }
// ══════════════════════════════════════════════════════════════
router.post("/add", (req, res) => {
  const { brand_id, outlet_name, address, city, latitude, longitude, phone, timing } = req.body;

  if (!brand_id || !outlet_name || !address || !city || latitude == null || longitude == null) {
    return res.status(400).json({ error: "Missing required fields: brand_id, outlet_name, address, city, latitude, longitude" });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "Invalid latitude or longitude values" });
  }

  db.query(
    `INSERT INTO outlets (brand_id, outlet_name, address, city, latitude, longitude, phone, timing)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [brand_id, outlet_name.trim(), address.trim(), city.trim(), lat, lng, phone?.trim() || null, timing?.trim() || null],
    (err, result) => {
      if (err) {
        console.error("POST /api/outlets/add error:", err);
        return res.status(500).json({ error: "Failed to add outlet" });
      }
      res.json({ success: true, outlet_id: result.insertId, message: "Outlet added successfully" });
    }
  );
});

// ══════════════════════════════════════════════════════════════
//  DELETE /api/outlets/:id
//  Brand removes their outlet (verify brand_id ownership)
//  Body: { brand_id }
// ══════════════════════════════════════════════════════════════
router.delete("/:id", (req, res) => {
  const outletId = req.params.id;
  const brand_id = req.body?.brand_id || req.query?.brand_id;

  if (!brand_id) {
    return res.status(400).json({ error: "brand_id required" });
  }

  // First verify this outlet belongs to the brand
  db.query(
    "SELECT outlet_id FROM outlets WHERE outlet_id = ? AND brand_id = ?",
    [outletId, brand_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!rows.length) return res.status(403).json({ error: "Outlet not found or unauthorized" });

      db.query("DELETE FROM outlets WHERE outlet_id = ?", [outletId], (err2) => {
        if (err2) return res.status(500).json({ error: "Delete failed" });
        res.json({ success: true, message: "Outlet removed" });
      });
    }
  );
});

module.exports = router;