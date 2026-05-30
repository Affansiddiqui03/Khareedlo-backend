// Khareedlo Backend/routes/brandProfileRoutes.js
// FIXED:
// 1. Removed "AND status = 'APPROVED'" from GET — brands can always view their own profile
// 2. PUT updates DB and changes propagate immediately across the whole platform
// 3. brand_name update removed (should not change)

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// ── GET /api/brand-profile/:brandId ──────────────────────────
// Returns brand profile — NO status filter (brand must see their own data)
router.get("/:brandId", (req, res) => {
  const sql = `
    SELECT
      brand_name  AS name,
      email,
      contact,
      city,
      address,
      description,
      website
    FROM brands
    WHERE brand_id = ?
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!result.length) return res.status(404).json({ error: "Brand not found" });
    res.json(result[0]);
  });
});

// ── PUT /api/brand-profile/:brandId ──────────────────────────
// Update editable profile fields — updates brands table immediately
// Changes reflect everywhere: brand page, outlet info, homepage, etc.
router.put("/:brandId", (req, res) => {
  const { contact, city, address, description, website } = req.body;

  // Validate website URL format if provided
  if (website && website.trim()) {
    try {
      new URL(website.startsWith("http") ? website : `https://${website}`);
    } catch {
      return res.status(400).json({ error: "Invalid website URL format" });
    }
  }

  const sql = `
    UPDATE brands
    SET
      contact     = ?,
      city        = ?,
      address     = ?,
      description = ?,
      website     = ?
    WHERE brand_id = ?
  `;

  db.query(
    sql,
    [
      contact?.trim()     || null,
      city?.trim()        || null,
      address?.trim()     || null,
      description?.trim() || null,
      website?.trim()     || null,
      req.params.brandId,
    ],
    (err, result) => {
      if (err) {
        console.error("Profile update error:", err);
        return res.status(500).json({ error: "Update failed. Please try again." });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Brand not found" });
      }
      res.json({ success: true, message: "Profile updated successfully" });
    }
  );
});

module.exports = router;