// Khareedlo Backend/routes/posRoutes.js
// FIXED:
// 1. Added POST /track — was MISSING, so no clicks were being recorded!
// 2. Fixed GET /summary/:brandId — returns correct keys + fills all 7 days
// 3. Weekly chart now returns "Add to Cart" + "Buy Now" keys per day

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// ── POST /api/pos/track — record a click event ────────────────
// Called from ProductDetails, ProductsPublic, Cart whenever
// user clicks Add to Cart or Buy Now
router.post("/track", (req, res) => {
  const { brand_id, product_id, action } = req.body;

  if (!brand_id || !product_id || !action) {
    return res.status(400).json({ error: "brand_id, product_id, action required" });
  }

  const validActions = ["ADD_TO_CART", "BUY_NOW"];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(", ")}` });
  }

  const sql = `
    INSERT INTO pos_activity (brand_id, product_id, action, created_at)
    VALUES (?, ?, ?, NOW())
  `;

  db.query(sql, [brand_id, product_id, action], (err) => {
    if (err) {
      console.error("POS track error:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json({ success: true });
  });
});

// ── GET /api/pos/summary/:brandId ─────────────────────────────
// Used by Overview.jsx and Analytics.jsx
// Returns:
//   products[]   — all brand products with their click counts
//   last7Days[]  — last 7 days data with { day, "Add to Cart", "Buy Now" }
router.get("/summary/:brandId", (req, res) => {
  const brandId = req.params.brandId;

  // All products for this brand with their total click counts
  const productsSql = `
    SELECT
      p.product_id,
      p.product_name,
      p.image,
      p.price,
      COALESCE(SUM(CASE WHEN pa.action = 'ADD_TO_CART' THEN 1 ELSE 0 END), 0) AS cart_clicks,
      COALESCE(SUM(CASE WHEN pa.action = 'BUY_NOW'    THEN 1 ELSE 0 END), 0) AS buy_now_clicks
    FROM products p
    LEFT JOIN pos_activity pa ON p.product_id = pa.product_id AND pa.brand_id = ?
    WHERE p.brand_id = ?
    GROUP BY p.product_id, p.product_name, p.image, p.price
    ORDER BY (cart_clicks + buy_now_clicks) DESC
  `;

  // Per-day breakdown for last 7 days
  // Returns a row for each day that had activity
  const chartSql = `
    SELECT
      DATE(pa.created_at)  AS raw_date,
      DATE_FORMAT(pa.created_at, '%a') AS day,
      COALESCE(SUM(CASE WHEN pa.action = 'ADD_TO_CART' THEN 1 ELSE 0 END), 0) AS \`Add to Cart\`,
      COALESCE(SUM(CASE WHEN pa.action = 'BUY_NOW'    THEN 1 ELSE 0 END), 0) AS \`Buy Now\`
    FROM pos_activity pa
    WHERE pa.brand_id = ?
      AND pa.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(pa.created_at)
    ORDER BY raw_date ASC
  `;

  db.query(productsSql, [brandId, brandId], (err, products) => {
    if (err) return res.status(500).json({ error: "DB error on products" });

    db.query(chartSql, [brandId], (err2, chartRows) => {
      if (err2) return res.status(500).json({ error: "DB error on chart" });

      // Fill all 7 days — even days with no activity show 0
      const last7Days = buildLast7Days(chartRows);

      res.json({ products, last7Days });
    });
  });
});

// ── Helper: ensure all 7 days present ────────────────────────
function buildLast7Days(dbRows) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result   = [];

  for (let i = 6; i >= 0; i--) {
    const d    = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];       // "2026-05-12"
    const dayName = dayNames[d.getDay()];                // "Mon"

    const found = dbRows.find(r => r.raw_date?.toISOString?.()?.startsWith(dateStr)
      || String(r.raw_date)?.startsWith(dateStr));

    result.push({
      day:            dayName,
      "Add to Cart":  found ? Number(found["Add to Cart"]) : 0,
      "Buy Now":      found ? Number(found["Buy Now"])     : 0,
    });
  }

  return result;
}

module.exports = router;