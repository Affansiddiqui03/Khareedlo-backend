// backend/routes/trendingRoutes.js  — REPLACE completely
// Now truly data-driven: ranks by (buy_now + add_to_cart + product_clicks + avg_rating)

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { resolveProductImage } = require("../utils/imageHelper");

router.get("/", (req, res) => {
  const sql = `
    SELECT
      p.product_id                                          AS id,
      p.product_name,
      p.product_name                                        AS title,
      p.price,
      p.image,
      p.buy_now_link,
      p.avg_rating,
      p.rating_count,
      b.brand_name                                          AS brand,
      b.brand_id,
      COALESCE(pos.buy_clicks, 0)                           AS buy_clicks,
      COALESCE(pos.cart_clicks, 0)                          AS cart_clicks,
      COALESCE(upc.user_clicks, 0)                          AS user_clicks,
      (
        COALESCE(pos.buy_clicks,  0) * 3  +
        COALESCE(pos.cart_clicks, 0) * 2  +
        COALESCE(upc.user_clicks, 0) * 1  +
        COALESCE(p.avg_rating, 0)    * 10
      )                                                     AS score
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id AND b.status = 'APPROVED'
    LEFT JOIN (
      SELECT
        product_id,
        SUM(action = 'BUY_NOW')     AS buy_clicks,
        SUM(action = 'ADD_TO_CART') AS cart_clicks
      FROM pos_activity
      GROUP BY product_id
    ) pos ON pos.product_id = p.product_id
    LEFT JOIN (
      SELECT product_id, COUNT(*) AS user_clicks
      FROM user_product_clicks
      GROUP BY product_id
    ) upc ON upc.product_id = p.product_id
    WHERE p.status = 'APPROVED'
    ORDER BY score DESC
    LIMIT 8
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Trending SQL error:", err);
      return res.status(500).json([]);
    }

    const result = rows.map(p => ({
      ...p,
      image: p.image && p.image !== "photos/" && p.image !== ""
        ? p.image
        : resolveProductImage(p.product_name),
      trending: true,
    }));

    res.json(result);
  });
});

module.exports = router;