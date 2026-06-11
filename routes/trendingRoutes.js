// backend/routes/trendingRoutes.js
// Trending score formula:
//   buy_now_clicks   × 5  (strongest intent — user clicked Buy Now)
//   buy_redirects    × 4  (confirmed purchase intent — logged-in user buy redirect)
//   cart_clicks      × 2  (moderate interest)
//   product_clicks   × 1  (casual browsing)
//   avg_rating       × 10 (quality signal — tiebreaker when clicks are equal)
//
// Tiebreaker logic:
//   If all products have same rating → clicks differentiate
//   If all products have same clicks → rating differentiates
//   If BOTH same → ORDER BY rating_count DESC (more reviews = more trusted)

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { resolveProductImage } = require("../utils/imageHelper");

router.get("/", (req, res) => {
  const sql = `
    SELECT
      p.product_id                                              AS id,
      p.product_name,
      p.product_name                                           AS title,
      p.price,
      p.image,
      p.buy_now_link,
      COALESCE(p.avg_rating,    0)                             AS avg_rating,
      COALESCE(p.rating_count,  0)                             AS rating_count,
      b.brand_name                                             AS brand,
      b.brand_id,

      -- Click signals from pos_activity (tracks ALL users incl. guests)
      COALESCE(pos.buy_clicks,  0)                             AS buy_clicks,
      COALESCE(pos.cart_clicks, 0)                             AS cart_clicks,

      -- Buy redirects from logged-in users (strongest purchase intent signal)
      COALESCE(ubr.buy_redirects, 0)                           AS buy_redirects,

      -- Product detail page views from logged-in users
      COALESCE(upc.product_clicks, 0)                          AS product_clicks,

      -- TRENDING SCORE
      (
        COALESCE(pos.buy_clicks,    0) * 5  +
        COALESCE(ubr.buy_redirects, 0) * 4  +
        COALESCE(pos.cart_clicks,   0) * 2  +
        COALESCE(upc.product_clicks,0) * 1  +
        COALESCE(p.avg_rating,      0) * 10
      )                                                        AS score

    FROM products p
    JOIN brands b
      ON p.brand_id = b.brand_id
     AND b.status = 'APPROVED'

    -- Buy Now + Add to Cart clicks (guest + logged-in, all brands)
    LEFT JOIN (
      SELECT
        product_id,
        SUM(action = 'BUY_NOW')     AS buy_clicks,
        SUM(action = 'ADD_TO_CART') AS cart_clicks
      FROM pos_activity
      GROUP BY product_id
    ) pos ON pos.product_id = p.product_id

    -- Buy redirects from logged-in users
    LEFT JOIN (
      SELECT product_id, COUNT(*) AS buy_redirects
      FROM user_buy_redirects
      GROUP BY product_id
    ) ubr ON ubr.product_id = p.product_id

    -- Product detail page clicks from logged-in users
    LEFT JOIN (
      SELECT product_id, COUNT(*) AS product_clicks
      FROM user_product_clicks
      GROUP BY product_id
    ) upc ON upc.product_id = p.product_id

    WHERE p.status = 'APPROVED'

    -- Primary: score DESC
    -- Tiebreaker 1: rating DESC (higher quality wins if clicks equal)
    -- Tiebreaker 2: rating_count DESC (more reviewed = more trusted)
    ORDER BY score DESC, p.avg_rating DESC, p.rating_count DESC

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