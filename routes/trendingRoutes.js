const express = require("express");
const router = express.Router();
const db = require("../config/db"); // path check kar lena

router.get("/", (req, res) => {
  const sql = `
    SELECT 
      p.product_id,
      p.product_name,
      p.image,
      p.price,
      COUNT(pa.pos_id) AS buy_now_clicks
    FROM pos_activity pa
    JOIN products p ON pa.product_id = p.product_id
    WHERE pa.action = 'BUY_NOW'
    GROUP BY p.product_id
    ORDER BY buy_now_clicks DESC
    LIMIT 8
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(result);
  });
});

module.exports = router;
