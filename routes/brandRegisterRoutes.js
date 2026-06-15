const express  = require("express");
const router   = express.Router();
const db       = require("../config/db");
const bcrypt   = require("bcryptjs");
const { uploadLogo } = require("../config/cloudinary");
const { sendAdminNewBrandNotification } = require("../services/emailService");

const ADMIN_EMAIL = "khareedlo@gmail.com";

// ── POST /api/brand/register ──────────────────────────────────
router.post("/register", uploadLogo.single("logo"), (req, res) => {
  const { brandName, email, password, contact, website } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();
  const logo = req.file ? req.file.path : null;

  // Basic validation
  if (!brandName || !brandName.trim())
    return res.status(400).json({ message: "Brand name is required" });
  if (!normalizedEmail || !normalizedEmail.includes("@"))
    return res.status(400).json({ message: "Please enter a valid email address" });
  if (!password || password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  if (normalizedEmail === ADMIN_EMAIL)
    return res.status(400).json({ message: "This email address is not available." });

  // FIX #1: Use callback-based db.query (not await)
  // Check brand email duplicate
  db.query("SELECT brand_id FROM brands WHERE LOWER(email)=?", [normalizedEmail], (err, brandRows) => {
    if (err) {
      console.error("DB error (brand check):", err);
      return res.status(500).json({ message: "Registration failed. Please try again." });
    }

    if (brandRows.length) {
      return res.status(400).json({ message: "A brand with this email already exists. Please login." });
    }

    // Check user email duplicate
    db.query("SELECT user_id FROM users WHERE LOWER(email)=?", [normalizedEmail], (err2, userRows) => {
      if (err2) {
        console.error("DB error (user check):", err2);
        return res.status(500).json({ message: "Registration failed. Please try again." });
      }

      if (userRows.length) {
        return res.status(400).json({ message: "This email is already a customer account. Use a different email." });
      }

      // FIX #2: Hash password before storing
      bcrypt.hash(password, 12, (hashErr, hashedPassword) => {
        if (hashErr) {
          console.error("Bcrypt error:", hashErr);
          return res.status(500).json({ message: "Registration failed. Please try again." });
        }

        const sql = `
          INSERT INTO brands (brand_name, email, password, contact, website, logo, status)
          VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
        `;

        db.query(sql, [brandName.trim(), normalizedEmail, hashedPassword, contact || "", website || "", logo], (err3, result) => {
          if (err3) {
            console.error("Brand insert error:", err3);
            return res.status(500).json({ message: "Registration failed. Please try again." });
          }

          // Send admin notification email (non-blocking)
          sendAdminNewBrandNotification(brandName.trim(), normalizedEmail).catch(() => {});

          res.json({ message: "Brand registered successfully, awaiting admin approval" });
        });
      });
    });
  });
});

module.exports = router;
