// backend/routes/homeRoutes.js  — REPLACE completely
// Popular brands: ranked by engagement + rating (not hardcoded)

const express = require("express");
const db      = require("../config/db");
const router  = express.Router();

router.get("/popular-brands", (req, res) => {
  const sql = `
    SELECT
      b.brand_id   AS id,
      b.brand_name AS name,
      b.rating,
      b.city,
      b.logo,
      b.description,
      COALESCE(pos.engagement, 0)  AS pos_engagement,
      COALESCE(ubv.visit_count, 0) AS visit_count,
      (
        COALESCE(pos.engagement,  0) * 2 +
        COALESCE(ubv.visit_count, 0) * 1 +
        COALESCE(b.rating, 0)         * 10
      ) AS score
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
    ORDER BY score DESC
    LIMIT 4
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

module.exports = router;