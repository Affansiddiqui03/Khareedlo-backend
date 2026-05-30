// backend/routes/ratingsRoutes.js  — NEW FILE
// Register in server.js: app.use("/api/ratings", require("./routes/ratingsRoutes"));

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// ══════════════════════════════════════════════════════
//  PRODUCT RATING
// ══════════════════════════════════════════════════════

// GET: check if customer already rated a product + get avg rating
router.get("/product/:productId", (req, res) => {
  const { productId } = req.params;
  const { customer_id } = req.query;

  const avgSql = `
    SELECT
      ROUND(AVG(rating), 1) AS avg_rating,
      COUNT(*) AS rating_count
    FROM product_ratings
    WHERE product_id = ?
  `;

  db.query(avgSql, [productId], (err, avgRows) => {
    if (err) return res.status(500).json({ message: "DB error" });

    const avg   = avgRows[0]?.avg_rating   || 0;
    const count = avgRows[0]?.rating_count || 0;

    if (!customer_id) {
      return res.json({ avg_rating: avg, rating_count: count, user_rating: null });
    }

    db.query(
      "SELECT rating FROM product_ratings WHERE customer_id = ? AND product_id = ?",
      [customer_id, productId],
      (err2, userRows) => {
        if (err2) return res.status(500).json({ message: "DB error" });
        res.json({
          avg_rating:   avg,
          rating_count: count,
          user_rating:  userRows[0]?.rating || null,
        });
      }
    );
  });
});

// POST: submit product rating (once per customer per product — DB enforces uniqueness)
router.post("/product", (req, res) => {
  const { customer_id, product_id, rating } = req.body;

  if (!customer_id || !product_id || !rating)
    return res.status(400).json({ message: "customer_id, product_id, rating required" });
  if (rating < 1 || rating > 5)
    return res.status(400).json({ message: "Rating must be 1-5" });

  // INSERT IGNORE so duplicate attempts don't error — they just silently skip
  db.query(
    `INSERT IGNORE INTO product_ratings (customer_id, product_id, rating) VALUES (?, ?, ?)`,
    [customer_id, product_id, rating],
    (err, result) => {
      if (err) return res.status(500).json({ message: "DB error" });

      if (result.affectedRows === 0) {
        return res.status(409).json({ message: "Already rated", already_rated: true });
      }

      // Update cached avg_rating on product
      db.query(
        `UPDATE products SET
           avg_rating   = (SELECT ROUND(AVG(rating),2) FROM product_ratings WHERE product_id = ?),
           rating_count = (SELECT COUNT(*) FROM product_ratings WHERE product_id = ?)
         WHERE product_id = ?`,
        [product_id, product_id, product_id],
        () => {} // fire and forget
      );

      res.json({ success: true, message: "Rating submitted" });
    }
  );
});

// ══════════════════════════════════════════════════════
//  BRAND RATING
// ══════════════════════════════════════════════════════

// GET: check if customer already rated a brand + get avg
router.get("/brand/:brandId", (req, res) => {
  const { brandId } = req.params;
  const { customer_id } = req.query;

  const avgSql = `
    SELECT
      ROUND(AVG(rating), 1) AS avg_rating,
      COUNT(*) AS rating_count
    FROM brand_ratings
    WHERE brand_id = ?
  `;

  db.query(avgSql, [brandId], (err, avgRows) => {
    if (err) return res.status(500).json({ message: "DB error" });

    const avg   = avgRows[0]?.avg_rating   || 0;
    const count = avgRows[0]?.rating_count || 0;

    if (!customer_id) {
      return res.json({ avg_rating: avg, rating_count: count, user_rating: null });
    }

    db.query(
      "SELECT rating FROM brand_ratings WHERE customer_id = ? AND brand_id = ?",
      [customer_id, brandId],
      (err2, userRows) => {
        if (err2) return res.status(500).json({ message: "DB error" });
        res.json({
          avg_rating:   avg,
          rating_count: count,
          user_rating:  userRows[0]?.rating || null,
        });
      }
    );
  });
});

// POST: submit brand rating
router.post("/brand", (req, res) => {
  const { customer_id, brand_id, rating } = req.body;

  if (!customer_id || !brand_id || !rating)
    return res.status(400).json({ message: "customer_id, brand_id, rating required" });
  if (rating < 1 || rating > 5)
    return res.status(400).json({ message: "Rating must be 1-5" });

  db.query(
    `INSERT IGNORE INTO brand_ratings (customer_id, brand_id, rating) VALUES (?, ?, ?)`,
    [customer_id, brand_id, rating],
    (err, result) => {
      if (err) return res.status(500).json({ message: "DB error" });

      if (result.affectedRows === 0) {
        return res.status(409).json({ message: "Already rated", already_rated: true });
      }

      // Update brands.rating with new avg
      db.query(
        `UPDATE brands SET rating = (
           SELECT ROUND(AVG(rating), 1) FROM brand_ratings WHERE brand_id = ?
         ) WHERE brand_id = ?`,
        [brand_id, brand_id],
        () => {}
      );

      res.json({ success: true, message: "Brand rating submitted" });
    }
  );
});

// ══════════════════════════════════════════════════════
//  BRAND DASHBOARD: ratings breakdown per brand
// ══════════════════════════════════════════════════════

// GET: brand sees their own rating stats
router.get("/brand/:brandId/stats", (req, res) => {
  const { brandId } = req.params;

  const sql = `
    SELECT
      ROUND(AVG(br.rating), 1) AS avg_rating,
      COUNT(br.id)             AS total_ratings,
      SUM(br.rating = 5)       AS five_star,
      SUM(br.rating = 4)       AS four_star,
      SUM(br.rating = 3)       AS three_star,
      SUM(br.rating = 2)       AS two_star,
      SUM(br.rating = 1)       AS one_star
    FROM brand_ratings br
    WHERE br.brand_id = ?
  `;

  db.query(sql, [brandId], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(rows[0] || { avg_rating: 0, total_ratings: 0 });
  });
});

// GET: brand sees per-product rating stats
router.get("/brand/:brandId/products", (req, res) => {
  const { brandId } = req.params;

  const sql = `
    SELECT
      p.product_id,
      p.product_name,
      p.avg_rating,
      p.rating_count,
      ROUND(AVG(pr.rating), 1) AS live_avg,
      COUNT(pr.id)             AS live_count
    FROM products p
    LEFT JOIN product_ratings pr ON p.product_id = pr.product_id
    WHERE p.brand_id = ?
    GROUP BY p.product_id
    ORDER BY live_avg DESC
  `;

  db.query(sql, [brandId], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(rows);
  });
});

module.exports = router;