const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* =========================
   MULTER CONFIG (PRODUCT IMAGES)
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../photos/products");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"), false);
  },
});

/* =========================
   GET ALL APPROVED BRANDS
========================= */
router.get("/", (req, res) => {
  const sql = `
    SELECT
      brand_id AS id,
      brand_name AS name,
      city,
      description,
      website,
      rating,
      logo,
      contact
    FROM brands
    WHERE status = 'APPROVED'
    ORDER BY rating DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

/* =========================
   GET SINGLE BRAND
========================= */
router.get("/:id", (req, res) => {
  const sql = `
    SELECT
      brand_id AS id,
      brand_name AS name,
      city,
      description,
      website,
      rating,
      logo,
      contact
    FROM brands
    WHERE brand_id = ? AND status = 'APPROVED'
  `;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (!result.length) return res.status(404).json({ msg: "Brand not found" });
    res.json(result[0]);
  });
});

/* =========================
   BRAND PRODUCTS
========================= */
router.get("/products/:brandId", (req, res) => {
  const sql = `
    SELECT *
    FROM products
    WHERE brand_id = ?
    ORDER BY product_id DESC
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

/* =========================
   ADD PRODUCT (FIXED)
   👉 THIS FIXES YOUR "FAILED TO ADD PRODUCT"
========================= */
router.post("/add-product", upload.single("image"), (req, res) => {
  const {
    brand_id,
    product_name,
    price,
    category_id,
    sub_category_id,
    gender,
    buy_now_link,
    website_link
  } = req.body;

  if (!brand_id || !product_name || !price) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const imagePath = req.file
    ? `photos/products/${req.file.filename}`
    : null;

  const sql = `
    INSERT INTO products
    (brand_id, product_name, price, category_id, sub_category_id, gender, image, buy_now_link, website_link, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `;

  db.query(
    sql,
    [
      brand_id,
      product_name,
      price,
      category_id || null,
      sub_category_id || null,
      gender || "Women",
      imagePath,
      buy_now_link || null,
      website_link || null
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to add product" });
      }

      res.json({
        success: true,
        product_id: result.insertId,
        status: "PENDING"
      });
    }
  );
});

/* =========================
   DELETE PRODUCT
========================= */
router.delete("/products/:id", (req, res) => {
  db.query(
    "DELETE FROM products WHERE product_id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

/* =========================
   BRAND OVERVIEW (DASHBOARD)
========================= */
router.get("/overview/:brandId", (req, res) => {
  const brandId = req.params.brandId;

  const sql = `
    SELECT COUNT(*) AS total_products
    FROM products
    WHERE brand_id = ? AND status = 'APPROVED'
  `;

  db.query(sql, [brandId], (err, result) => {
    if (err) return res.status(500).json(err);

    res.json({
      total_products: result[0].total_products || 0
    });
  });
});

/* =========================
   POS ANALYTICS
========================= */
router.get("/pos/summary/:brandId", (req, res) => {
  const brandId = req.params.brandId;

  const productSql = `
    SELECT pa.product_id, p.product_name,
      SUM(CASE WHEN pa.action='ADD_TO_CART' THEN 1 ELSE 0 END) AS cart_clicks,
      SUM(CASE WHEN pa.action='BUY_NOW' THEN 1 ELSE 0 END) AS buy_now_clicks
    FROM pos_activity pa
    JOIN products p ON pa.product_id = p.product_id
    WHERE pa.brand_id = ?
    GROUP BY pa.product_id
  `;

  const daysSql = `
    SELECT
      DATE_FORMAT(created_at, '%a') AS day,
      SUM(CASE WHEN action='ADD_TO_CART' THEN 1 ELSE 0 END) AS cart,
      SUM(CASE WHEN action='BUY_NOW' THEN 1 ELSE 0 END) AS buy
    FROM pos_activity
    WHERE brand_id = ?
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  `;

  db.query(productSql, [brandId], (err, products) => {
    if (err) return res.status(500).json(err);

    db.query(daysSql, [brandId], (err2, last7Days) => {
      if (err2) return res.status(500).json(err2);

      res.json({ products, last7Days });
    });
  });
});

module.exports = router;