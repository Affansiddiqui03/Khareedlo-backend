const express = require("express");
const router = express.Router();
const db = require("../config/db"); // adjust path if needed

router.get("/summary/:brandId", (req, res) => {
  const brandId = req.params.brandId;

  const productsSql = `
    SELECT 
      p.product_id,
      p.product_name,
      COUNT(CASE WHEN pa.action='ADD_TO_CART' THEN 1 END) AS cart_clicks,
      COUNT(CASE WHEN pa.action='BUY_NOW' THEN 1 END) AS buy_now_clicks
    FROM products p
    LEFT JOIN pos_activity pa ON p.product_id = pa.product_id
    WHERE p.brand_id = ?
    GROUP BY p.product_id
  `;

  const chartSql = `
    SELECT 
      DATE(pa.created_at) AS day,
      COUNT(CASE WHEN pa.action='BUY_NOW' THEN 1 END) AS sales
    FROM pos_activity pa
    WHERE pa.brand_id = ?
      AND pa.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(pa.created_at)
    ORDER BY day ASC
  `;

  db.query(productsSql, [brandId], (err, products) => {
    if (err) return res.status(500).json({ error: "DB error" });

    db.query(chartSql, [brandId], (err, chart) => {
      if (err) return res.status(500).json({ error: "DB error" });

      res.json({
        products,
        last7Days: chart
      });
    });
  });
});


module.exports = router;
