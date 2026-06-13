// Khareedlo Backend/routes/brandDashboardRoutes.js
const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { uploadProduct } = require("../config/cloudinary");
const { sendAdminNewProductNotification } = require("../services/emailService");

// ── PKT timezone helper (UTC+5) ───────────────────────────────
function toPKTDateStr(date) {
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const pktDate = new Date(date.getTime() + PKT_OFFSET_MS);
  const y = pktDate.getUTCFullYear();
  const m = String(pktDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pktDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPKTDayName(date) {
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const pktDate = new Date(date.getTime() + PKT_OFFSET_MS);
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][pktDate.getUTCDay()];
}

function buildLast7Days(dbRows) {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d      = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const pktStr = toPKTDateStr(d);
    const day    = getPKTDayName(d);
    const found  = dbRows.find(r => {
      const raw = r.raw_date;
      if (!raw) return false;
      if (typeof raw.toISOString === "function") return toPKTDateStr(raw) === pktStr;
      return String(raw).slice(0, 10) === pktStr;
    });
    result.push({
      day,
      cart: found ? Number(found.cart || 0) : 0,
      buy:  found ? Number(found.buy  || 0) : 0,
    });
  }
  return result;
}

// ── OVERVIEW ─────────────────────────────────────────────────
router.get("/overview/:brandId", (req, res) => {
  const brandId = req.params.brandId;
  db.query(
    `SELECT
       COUNT(DISTINCT p.product_id)                     AS total_products,
       COALESCE(SUM(pa.action = 'ADD_TO_CART'), 0)      AS cart_clicks,
       COALESCE(SUM(pa.action = 'BUY_NOW'),     0)      AS buy_clicks
     FROM products p
     LEFT JOIN pos_activity pa ON p.product_id = pa.product_id
     WHERE p.brand_id = ?`,
    [brandId],
    (err, stats) => {
      if (err) return res.status(500).json({ error: "DB error" });
      db.query(
        `SELECT p.product_name,
           COALESCE(SUM(pa.action='ADD_TO_CART'),0) + COALESCE(SUM(pa.action='BUY_NOW'),0) AS total
         FROM products p
         LEFT JOIN pos_activity pa ON p.product_id = pa.product_id
         WHERE p.brand_id = ?
         GROUP BY p.product_id
         ORDER BY total DESC
         LIMIT 1`,
        [brandId],
        (err2, top) => {
          if (err2) return res.status(500).json({ error: "DB error" });
          res.json({ ...stats[0], top_product: top[0]?.product_name || "—" });
        }
      );
    }
  );
});

// ── PRODUCTS LIST ─────────────────────────────────────────────
router.get("/products/:brandId", (req, res) => {
  db.query(
    `SELECT product_id, brand_id, product_name, price, gender, image,
            buy_now_link, website_link, status, category_id, sub_category_id
     FROM products WHERE brand_id = ? ORDER BY product_id DESC`,
    [req.params.brandId],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// ── ADD PRODUCT ───────────────────────────────────────────────
router.post("/add-product", uploadProduct.single("image"), (req, res) => {
  const { brand_id, product_name, price, category_id, sub_category_id, gender, buy_now_link, website_link } = req.body;

  if (!brand_id || !product_name || !price || !category_id)
    return res.status(400).json({ message: "Missing required fields" });

  const imagePath = req.file ? req.file.path : null; // Cloudinary full URL

  db.query(
    `INSERT INTO products
       (brand_id, product_name, price, category_id, sub_category_id, gender, image, buy_now_link, website_link, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [brand_id, product_name, price, category_id || 1, sub_category_id || 1, gender || "Women", imagePath, buy_now_link || null, website_link || null],
    (err, result) => {
      if (err) { console.error("Add product error:", err); return res.status(500).json({ message: "Failed to add product" }); }

      // Notify admin about new pending product
      db.query("SELECT brand_name FROM brands WHERE brand_id = ?", [brand_id], (err2, rows) => {
        if (!err2 && rows.length) {
          sendAdminNewProductNotification(rows[0].brand_name, product_name).catch(() => {});
        }
      });

      res.json({ success: true, product_id: result.insertId, status: "PENDING" });
    }
  );
});

// ── DELETE PRODUCT ────────────────────────────────────────────
router.delete("/products/:productId", (req, res) => {
  db.query("DELETE FROM products WHERE product_id = ?", [req.params.productId], (err) => {
    if (err) return res.status(500).json({ message: "Delete failed" });
    res.json({ success: true });
  });
});

// ── SUMMARY ───────────────────────────────────────────────────
router.get("/summary/:brandId", (req, res) => {
  db.query(
    `SELECT p.product_name,
       COALESCE(SUM(CASE WHEN pa.action='ADD_TO_CART' THEN 1 ELSE 0 END),0) AS cart_clicks,
       COALESCE(SUM(CASE WHEN pa.action='BUY_NOW'    THEN 1 ELSE 0 END),0) AS buy_clicks
     FROM products p
     LEFT JOIN pos_activity pa ON p.product_id = pa.product_id
     WHERE p.brand_id = ?
     GROUP BY p.product_id
     ORDER BY (cart_clicks + buy_clicks) DESC`,
    [req.params.brandId],
    (err, products) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({
        total_products: products.length,
        cart_clicks:    products.reduce((a, p) => a + (p.cart_clicks || 0), 0),
        buy_clicks:     products.reduce((a, p) => a + (p.buy_clicks  || 0), 0),
        top_product:    products[0]?.product_name || "—",
      });
    }
  );
});

// ── POS ANALYTICS ─────────────────────────────────────────────
router.get("/pos/summary/:brandId", (req, res) => {
  const brandId = req.params.brandId;

  const productSql = `
    SELECT
      p.product_id, p.product_name, p.image, p.price,
      COALESCE(SUM(CASE WHEN pa.action='ADD_TO_CART' THEN 1 ELSE 0 END), 0) AS cart_clicks,
      COALESCE(SUM(CASE WHEN pa.action='BUY_NOW'    THEN 1 ELSE 0 END), 0) AS buy_now_clicks
    FROM products p
    LEFT JOIN pos_activity pa ON p.product_id = pa.product_id AND pa.brand_id = ?
    WHERE p.brand_id = ?
    GROUP BY p.product_id, p.product_name, p.image, p.price
    ORDER BY (cart_clicks + buy_now_clicks) DESC
  `;

  const daysSql = `
    SELECT
      DATE(CONVERT_TZ(created_at, '+00:00', '+05:00')) AS raw_date,
      COALESCE(SUM(CASE WHEN action='ADD_TO_CART' THEN 1 ELSE 0 END), 0) AS cart,
      COALESCE(SUM(CASE WHEN action='BUY_NOW'    THEN 1 ELSE 0 END), 0) AS buy
    FROM pos_activity
    WHERE brand_id = ?
      AND CONVERT_TZ(created_at, '+00:00', '+05:00') >= DATE_SUB(
            CONVERT_TZ(NOW(), '+00:00', '+05:00'), INTERVAL 6 DAY)
    GROUP BY DATE(CONVERT_TZ(created_at, '+00:00', '+05:00'))
    ORDER BY raw_date ASC
  `;

  db.query(productSql, [brandId, brandId], (err, products) => {
    if (err) return res.status(500).json({ error: "Product query error", detail: err.message });
    db.query(daysSql, [brandId], (err2, daysRows) => {
      if (err2) return res.status(500).json({ error: "Chart query error", detail: err2.message });
      res.json({ products, last7Days: buildLast7Days(daysRows) });
    });
  });
});

// ── EDIT PRODUCT (brand edits image/link/category, goes back to PENDING) ──────
router.patch("/products/:productId", uploadProduct.single("image"), (req, res) => {
  const { productId } = req.params;
  const { product_name, price, category_id, sub_category_id, gender, buy_now_link, website_link, brand_id } = req.body;

  // First verify this product belongs to this brand (security check)
  db.query("SELECT * FROM products WHERE product_id = ? AND brand_id = ?", [productId, brand_id], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!rows.length) return res.status(403).json({ message: "Product not found or not yours" });

    const imagePath = req.file ? req.file.path : rows[0].image; // keep old image if no new upload

    const fields = {
      product_name:    product_name?.trim()    || rows[0].product_name,
      price:           price                   || rows[0].price,
      category_id:     category_id             || rows[0].category_id,
      sub_category_id: sub_category_id         || rows[0].sub_category_id,
      gender:          gender                  || rows[0].gender,
      buy_now_link:    buy_now_link?.trim()    || rows[0].buy_now_link,
      website_link:    website_link?.trim()    || rows[0].website_link,
      image:           imagePath,
      status:          "PENDING", // always reset to PENDING so admin re-approves
    };

    db.query(
      `UPDATE products SET
         product_name=?, price=?, category_id=?, sub_category_id=?,
         gender=?, buy_now_link=?, website_link=?, image=?, status=?
       WHERE product_id=?`,
      [
        fields.product_name, fields.price, fields.category_id, fields.sub_category_id,
        fields.gender, fields.buy_now_link, fields.website_link, fields.image, fields.status,
        productId,
      ],
      (err2) => {
        if (err2) { console.error("Edit product error:", err2); return res.status(500).json({ message: "Update failed" }); }
        res.json({ success: true, status: "PENDING", message: "Product updated. Admin will re-approve before going live." });
      }
    );
  });
});

module.exports = router;