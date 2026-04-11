const express = require("express");
const router = express.Router();
const db = require("../config/db");

/* ================= OVERVIEW ================= */
router.get("/overview/:brandId", (req, res) => {
  const sql = `
    SELECT 
      COUNT(DISTINCT p.product_id) AS total_products,
      COALESCE(SUM(pa.action='ADD_TO_CART'),0) AS cart_clicks,
      COALESCE(SUM(pa.action='BUY_NOW'),0) AS buy_clicks
    FROM products p
    LEFT JOIN pos_activity pa ON p.product_id = pa.product_id
    WHERE p.brand_id = ?
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(result[0]);
  });
});

/* ================= PRODUCTS (BRAND DASHBOARD) ================= */
router.get("/products/:brandId", (req, res) => {
  db.query(
    "SELECT * FROM products WHERE brand_id = ? ORDER BY product_id DESC",
    [req.params.brandId],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

/* ================= SUMMARY REPORT ================= */
router.get("/summary/:brandId", (req, res) => {
  const sql = `
    SELECT 
      p.product_name,
      COUNT(CASE WHEN pa.action='ADD_TO_CART' THEN 1 END) AS cart_clicks,
      COUNT(CASE WHEN pa.action='BUY_NOW' THEN 1 END) AS buy_clicks
    FROM products p
    LEFT JOIN pos_activity pa ON p.product_id = pa.product_id
    WHERE p.brand_id = ?
    GROUP BY p.product_id
    ORDER BY buy_clicks DESC
  `;

  db.query(sql, [req.params.brandId], (err, products) => {
    if (err) return res.status(500).json({ error: "DB error" });

    const summary = {
      total_products: products.length,
      cart_clicks: products.reduce((a, p) => a + p.cart_clicks, 0),
      buy_clicks: products.reduce((a, p) => a + p.buy_clicks, 0),
      top_product: products[0]?.product_name || "—"
    };

    res.json(summary);
  });
});

module.exports = router;
