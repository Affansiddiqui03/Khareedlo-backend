const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Get all products
router.get("/", (req, res) => {
  const sql = `
    SELECT 
      p.product_id AS id,
      p.product_name AS title,
      p.price,
      p.gender AS category,   -- ✅ ADD THIS
      p.brand_id AS brand_id,
      b.brand_name AS brand,
      b.website AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});


// Get single product
router.get("/:id", (req, res) => {
  const sql = `
    SELECT 
      p.product_id AS id,
      p.product_name AS title,
      p.price,
      p.brand_id AS brand_id,
      b.brand_name AS brand,
      b.website AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    WHERE p.product_id = ?
  `;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (!result.length)
      return res.status(404).json({ msg: "Product not found" });

    res.json(result[0]);
  });
});


module.exports = router;
