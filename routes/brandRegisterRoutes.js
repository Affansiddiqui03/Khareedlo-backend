const express  = require("express");
const router   = express.Router();
const db       = require("../config/db");
const { uploadLogo } = require("../config/cloudinary");

// ── POST /api/brand/register ──────────────────────────────────
router.post("/register", uploadLogo.single("logo"), (req, res) => {
  const { brandName, email, password, contact, website } = req.body;
  const logo = req.file ? req.file.path : null; // Cloudinary full URL

  if (!brandName || !email || !password)
    return res.status(400).json({ message: "Missing required fields" });

  const sql = `
    INSERT INTO brands
    (brand_name, email, password, contact, website, logo, status)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
  `;

  db.query(sql, [brandName, email, password, contact, website, logo], (err) => {
    if (err) {
      console.error("Brand Register Error:", err);
      return res.status(400).json({ message: "Brand already exists or DB error" });
    }
    res.json({ message: "Brand registered, awaiting admin approval" });
  });
});

module.exports = router;