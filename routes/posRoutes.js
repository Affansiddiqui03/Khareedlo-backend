const express = require("express");
const router = express.Router();
const db = require("../config/db"); // adjust path if needed

router.get("/summary/:brandId", (req, res) => {
  const sql = `
    SELECT 
      p.product_name,
      COUNT(CASE WHEN pa.action='ADD_TO_CART' THEN 1 END) AS cart_clicks,
      COUNT(CASE WHEN pa.action='BUY_NOW' THEN 1 END) AS buy_now_clicks
    FROM pos_activity pa
    JOIN products p ON pa.product_id = p.product_id
    WHERE pa.brand_id = ?
    GROUP BY pa.product_id
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(result);
  });
});

module.exports = router;
