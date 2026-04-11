const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");

// ✅ STORAGE FIX
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "photos/brands"); // 👈 SAME AS STATIC
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// ✅ BRAND REGISTER
router.post("/register", upload.single("logo"), (req, res) => {
  const { brandName, email, password, contact, website } = req.body;
  const logo = req.file ? `photos/brands/${req.file.filename}` : null;

  if (!brandName || !email || !password) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sql = `
    INSERT INTO brands
    (brand_name, email, password, contact, website, logo, status)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
  `;

  db.query(
    sql,
    [brandName, email, password, contact, website, logo],
    (err) => {
      if (err) {
        console.error("Brand Register Error:", err);
        return res.status(400).json({ message: "Brand already exists" });
      }

      res.json({ message: "Brand registered, awaiting admin approval" });
    }
  );
});

module.exports = router;
