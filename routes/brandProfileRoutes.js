const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { uploadLogo, uploadBanner } = require("../config/cloudinary");

// ── GET /api/brand-profile/:brandId ──────────────────────────
router.get("/:brandId", (req, res) => {
  db.query(
    `SELECT brand_name AS name, email, contact, city,
            address, description, website, logo, banner, rating
     FROM brands WHERE brand_id = ?`,
    [req.params.brandId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!result.length) return res.status(404).json({ error: "Brand not found" });
      res.json(result[0]);
    }
  );
});

// ── PUT /api/brand-profile/:brandId — Update profile ─────────
router.put("/:brandId", (req, res) => {
  const { contact, city, address, description, website } = req.body;
  db.query(
    `UPDATE brands SET contact=?, city=?, address=?, description=?, website=?
     WHERE brand_id = ?`,
    [contact?.trim()||null, city?.trim()||null, address?.trim()||null,
     description?.trim()||null, website?.trim()||null, req.params.brandId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Update failed" });
      if (!result.affectedRows) return res.status(404).json({ error: "Brand not found" });
      res.json({ success: true, message: "Profile updated successfully" });
    }
  );
});

// ── POST /api/brand-profile/:brandId/banner — Cloudinary ─────
router.post("/:brandId/banner", uploadBanner.single("banner"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  const bannerUrl = req.file.path; // Cloudinary returns full URL in req.file.path
  db.query(
    "UPDATE brands SET banner=? WHERE brand_id=?",
    [bannerUrl, req.params.brandId],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true, banner: bannerUrl, message: "Banner updated!" });
    }
  );
});

// ── POST /api/brand-profile/:brandId/logo — Cloudinary ───────
router.post("/:brandId/logo", uploadLogo.single("logo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  const logoUrl = req.file.path;
  db.query(
    "UPDATE brands SET logo=? WHERE brand_id=?",
    [logoUrl, req.params.brandId],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true, logo: logoUrl, message: "Logo updated!" });
    }
  );
});

// ── POST /api/brand-profile/:brandId/change-password ─────────
router.post("/:brandId/change-password", (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: "All fields required" });
  if (newPassword.length < 6)
    return res.status(400).json({ error: "New password must be at least 6 characters" });

  db.query("SELECT password FROM brands WHERE brand_id=?", [req.params.brandId], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!rows.length) return res.status(404).json({ error: "Brand not found" });
    if (rows[0].password !== currentPassword)
      return res.status(401).json({ error: "Current password is incorrect" });

    db.query("UPDATE brands SET password=? WHERE brand_id=?",
      [newPassword, req.params.brandId],
      (err2) => {
        if (err2) return res.status(500).json({ error: "Update failed" });
        res.json({ success: true, message: "Password changed successfully!" });
      }
    );
  });
});

module.exports = router;
