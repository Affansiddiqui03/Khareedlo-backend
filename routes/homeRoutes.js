const express = require("express");
const db = require("../config/db");

const router = express.Router();

router.get("/popular-brands", (req, res) => {
  const sql = `
    SELECT 
      b.brand_id AS id,
      b.brand_name AS name,
      b.rating,
      b.city,
      COUNT(pa.pos_id) AS engagement
    FROM brands b
    LEFT JOIN pos_activity pa 
      ON b.brand_id = pa.brand_id
    WHERE b.brand_name IN ('J. By Junaid Jamshed', 'Alkaram')
    GROUP BY b.brand_id, b.brand_name, b.rating, b.city
    ORDER BY engagement DESC, b.rating DESC;
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

module.exports = router; // This is important!
