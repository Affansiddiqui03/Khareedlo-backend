const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { resolveProductImage } = require("../utils/imageHelper");

router.get("/", (req, res) => {
  const sql = `
    (
      SELECT 
        p.product_id AS id,
        p.product_name,
        p.product_name AS title,
        p.price,
        p.image,
        b.brand_name AS brand,
        COUNT(pa.pos_id) AS clicks
      FROM products p
      JOIN brands b ON p.brand_id = b.brand_id
      LEFT JOIN pos_activity pa 
        ON pa.product_id = p.product_id 
        AND pa.action = 'BUY_NOW'
      WHERE b.brand_name = 'J. By Junaid Jamshed'
      GROUP BY p.product_id
      ORDER BY clicks DESC
      LIMIT 2
    )
    UNION ALL
    (
      SELECT 
        p.product_id AS id,
        p.product_name,
        p.product_name AS title,
        p.price,
        p.image,
        b.brand_name AS brand,
        COUNT(pa.pos_id) AS clicks
      FROM products p
      JOIN brands b ON p.brand_id = b.brand_id
      LEFT JOIN pos_activity pa 
        ON pa.product_id = p.product_id 
        AND pa.action = 'BUY_NOW'
      WHERE b.brand_name = 'Alkaram'
      GROUP BY p.product_id
      ORDER BY clicks DESC
      LIMIT 2
    )
    UNION ALL
    (
      SELECT 
        p.product_id AS id,
        p.product_name,
        p.product_name AS title,
        p.price,
        p.image,
        b.brand_name AS brand,
        COUNT(pa.pos_id) AS clicks
      FROM products p
      JOIN brands b ON p.brand_id = b.brand_id
      LEFT JOIN pos_activity pa 
        ON pa.product_id = p.product_id 
        AND pa.action = 'BUY_NOW'
      WHERE b.brand_name = 'Limelight'
      GROUP BY p.product_id
      ORDER BY clicks DESC
      LIMIT 2
    );
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Trending SQL error:", err);
      return res.status(500).json([]);
    }

    res.json(
      rows.map(p => ({
        ...p,
        image:
          p.image &&
          p.image !== "photos/" &&
          p.image !== ""
            ? p.image
            : resolveProductImage(p.product_name)
      }))
    );
  });
});

module.exports = router;
