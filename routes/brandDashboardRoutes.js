// Khareedlo Backend/routes/brandDashboardRoutes.js
// FIX: Chart timezone — converts stored UTC timestamps to Pakistan Standard Time (UTC+5)
// so daily grouping aligns with Pakistan's actual date, not UTC date.
// Also fixes: image path in products query, all 7 days always present in weekly chart.

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { uploadProduct } = require("../config/cloudinary");
const upload = { single: (field) => uploadProduct.single(field) };
// upload.single is now Cloudinary — images stored permanently on Cloudinary


// ── PKT timezone helper (UTC+5) ───────────────────────────────
// Converts Node.js Date to a "YYYY-MM-DD" string in Pakistan time (UTC+5)
// regardless of what timezone the server OS is set to.
function toPKTDateStr(date) {
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // 5 hours in ms
  const pktDate = new Date(date.getTime() + PKT_OFFSET_MS);
  const y = pktDate.getUTCFullYear();
  const m = String(pktDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pktDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Day name from UTC date adjusted for PKT
function getPKTDayName(date) {
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const pktDate = new Date(date.getTime() + PKT_OFFSET_MS);
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][pktDate.getUTCDay()];
}

// Build full 7-day array — always returns all 7 days with zeros for missing days
// Matches db row dates against PKT dates, not UTC dates.
function buildLast7Days(dbRows) {
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d      = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const pktStr = toPKTDateStr(d);   // "2026-05-15" in PKT
    const day    = getPKTDayName(d);  // "Fri"

    // MySQL DATE(CONVERT_TZ(...)) returns a string like "2026-05-15"
    // or a Date object — handle both
    const found = dbRows.find(r => {
      const raw = r.raw_date;
      if (!raw) return false;
      // If it's a Date object, convert to PKT string for comparison
      if (typeof raw.toISOString === "function") return toPKTDateStr(raw) === pktStr;
      // If it's already a string like "2026-05-15"
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

/* ═══════════════════════════════════════════
   OVERVIEW
═══════════════════════════════════════════ */
router.get("/overview/:brandId", (req, res) => {
  const brandId = req.params.brandId;

  db.query(
    `SELECT
       COUNT(DISTINCT p.product_id)                                        AS total_products,
       COALESCE(SUM(pa.action = 'ADD_TO_CART'), 0)                        AS cart_clicks,
       COALESCE(SUM(pa.action = 'BUY_NOW'),     0)                        AS buy_clicks
     FROM products p
     LEFT JOIN pos_activity pa ON p.product_id = pa.product_id
     WHERE p.brand_id = ?`,
    [brandId],
    (err, stats) => {
      if (err) return res.status(500).json({ error: "DB error" });

      // Top product by total interactions
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

/* ═══════════════════════════════════════════
   PRODUCTS LIST
═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   ADD PRODUCT
═══════════════════════════════════════════ */
router.post("/add-product", upload.single("image"), (req, res) => {
  const { brand_id, product_name, price, category_id, sub_category_id, gender, buy_now_link, website_link } = req.body;

  if (!brand_id || !product_name || !price || !category_id) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const imagePath = req.file ? req.file.path : null; // Cloudinary full URL

  db.query(
    `INSERT INTO products
       (brand_id, product_name, price, category_id, sub_category_id, gender, image, buy_now_link, website_link, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [brand_id, product_name, price, category_id || 1, sub_category_id || 1, gender || "Women", imagePath, buy_now_link || null, website_link || null],
    (err, result) => {
      if (err) { console.error("Add product error:", err); return res.status(500).json({ message: "Failed to add product" }); }
      res.json({ success: true, product_id: result.insertId, status: "PENDING" });
    }
  );
});

/* ═══════════════════════════════════════════
   DELETE PRODUCT
═══════════════════════════════════════════ */
router.delete("/products/:productId", (req, res) => {
  db.query("DELETE FROM products WHERE product_id = ?", [req.params.productId], (err) => {
    if (err) return res.status(500).json({ message: "Delete failed" });
    res.json({ success: true });
  });
});

/* ═══════════════════════════════════════════
   SUMMARY REPORT
═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   POS ANALYTICS — TIMEZONE FIXED
   Uses CONVERT_TZ to group by Pakistan date (UTC+5)
   not UTC date, so Friday clicks appear on Friday.
═══════════════════════════════════════════ */
router.get("/pos/summary/:brandId", (req, res) => {
  const brandId = req.params.brandId;

  // Products with click counts
  const productSql = `
    SELECT
      p.product_id,
      p.product_name,
      p.image,
      p.price,
      COALESCE(SUM(CASE WHEN pa.action='ADD_TO_CART' THEN 1 ELSE 0 END), 0) AS cart_clicks,
      COALESCE(SUM(CASE WHEN pa.action='BUY_NOW'    THEN 1 ELSE 0 END), 0) AS buy_now_clicks
    FROM products p
    LEFT JOIN pos_activity pa ON p.product_id = pa.product_id AND pa.brand_id = ?
    WHERE p.brand_id = ?
    GROUP BY p.product_id, p.product_name, p.image, p.price
    ORDER BY (cart_clicks + buy_now_clicks) DESC
  `;

  // TIMEZONE FIX: Use CONVERT_TZ to convert UTC → PKT (+05:00) before DATE()
  // This ensures a click at 11 PM PKT Thursday stays as Thursday, not Friday UTC.
  // Also a click at 2 AM PKT Friday stays as Friday, not Thursday UTC.
  const daysSql = `
    SELECT
      DATE(CONVERT_TZ(created_at, '+00:00', '+05:00')) AS raw_date,
      COALESCE(SUM(CASE WHEN action='ADD_TO_CART' THEN 1 ELSE 0 END), 0) AS cart,
      COALESCE(SUM(CASE WHEN action='BUY_NOW'    THEN 1 ELSE 0 END), 0) AS buy
    FROM pos_activity
    WHERE brand_id = ?
      AND CONVERT_TZ(created_at, '+00:00', '+05:00') >= DATE_SUB(
            CONVERT_TZ(NOW(), '+00:00', '+05:00'), INTERVAL 6 DAY
          )
    GROUP BY DATE(CONVERT_TZ(created_at, '+00:00', '+05:00'))
    ORDER BY raw_date ASC
  `;

  db.query(productSql, [brandId, brandId], (err, products) => {
    if (err) return res.status(500).json({ error: "Product query error", detail: err.message });

    db.query(daysSql, [brandId], (err2, daysRows) => {
      if (err2) return res.status(500).json({ error: "Chart query error", detail: err2.message });

      const last7Days = buildLast7Days(daysRows);
      res.json({ products, last7Days });
    });
  });
});

module.exports = router;