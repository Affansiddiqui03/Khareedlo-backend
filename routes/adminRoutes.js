const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ================== BRANDS ==================

// Pending Brands
router.get("/brands/pending", (req, res) => {
  db.query(
    "SELECT brand_id, brand_name, email, city, phone, logo, website FROM brands WHERE status='PENDING'",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// Approve / Reject
router.put("/brands/:id", (req, res) => {
  const { action } = req.body;

  const status =
    action === "approve"
      ? "APPROVED"
      : action === "reject"
      ? "REJECTED"
      : null;

  if (!status)
    return res.status(400).json({ message: "Invalid action" });

  db.query(
    "UPDATE brands SET status=? WHERE brand_id=?",
    [status, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: `Brand ${status}` });
    }
  );
});

// All Approved Brands
router.get("/brands", (req, res) => {
  db.query(
    "SELECT * FROM brands WHERE status='APPROVED'",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// Delete Brand
router.delete("/brands/:id", (req, res) => {
  db.query(
    "DELETE FROM brands WHERE brand_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Brand deleted" });
    }
  );
});

// ================== USERS ==================
router.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ================== PRODUCTS ==================

// ✅ NEW: Get ALL products (for dashboard stats)
router.get("/products", (req, res) => {
  db.query("SELECT * FROM products", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Pending Products
router.get("/products/pending", (req, res) => {
  db.query(
    `SELECT p.*, b.brand_name 
     FROM products p 
     JOIN brands b ON p.brand_id = b.brand_id
     WHERE p.status='PENDING'`,
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// Approve Product
router.put("/products/:id", (req, res) => {
  db.query(
    "UPDATE products SET status='APPROVED' WHERE product_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Product approved" });
    }
  );
});

// Delete Product
router.delete("/products/:id", (req, res) => {
  db.query(
    "DELETE FROM products WHERE product_id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Product deleted" });
    }
  );
});

module.exports = router;