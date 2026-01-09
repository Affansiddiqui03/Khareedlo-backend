const express = require("express");
const router = express.Router();
const db = require("../config/db"); // make sure this path is correct

// Brand Overview route
router.get("/overview/:brandId", (req, res) => {
  const sql = `
    SELECT 
      COUNT(DISTINCT p.product_id) AS total_products,
      COUNT(CASE WHEN pa.action='ADD_TO_CART' THEN 1 END) AS cart_clicks,
      COUNT(CASE WHEN pa.action='BUY_NOW' THEN 1 END) AS buy_clicks
    FROM products p
    LEFT JOIN pos_activity pa ON p.product_id = pa.product_id
    WHERE p.brand_id = ?
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    // result is an array with one object
    res.json(result[0]);
  });
});

module.exports = router;
