// backend/routes/homeRoutes.js  — REPLACE completely
// Popular brands: ranked by engagement + rating (not hardcoded)

const express = require("express");
const db      = require("../config/db");
const router  = express.Router();

router.get("/popular-brands", (req, res) => {
  // Ranked the same way as the "Top Rated" sort on the Brand Listing page:
  // primarily by brand rating (b.rating), with engagement/visits only
  // used to break ties between brands that share the same rating.
  const sql = `
    SELECT
      b.brand_id   AS id,
      b.brand_name AS name,
      b.rating,
      b.city,
      b.logo,
      b.description,
      COALESCE(pos.engagement, 0)  AS pos_engagement,
      COALESCE(ubv.visit_count, 0) AS visit_count
    FROM brands b
    LEFT JOIN (
      SELECT brand_id, COUNT(*) AS engagement
      FROM pos_activity
      GROUP BY brand_id
    ) pos ON pos.brand_id = b.brand_id
    LEFT JOIN (
      SELECT brand_id, COUNT(*) AS visit_count
      FROM user_brand_visits
      GROUP BY brand_id
    ) ubv ON ubv.brand_id = b.brand_id
    WHERE b.status = 'APPROVED'
    ORDER BY
      COALESCE(b.rating, 0) DESC,
      (COALESCE(pos.engagement, 0) + COALESCE(ubv.visit_count, 0)) DESC
    LIMIT 4
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

module.exports = router;