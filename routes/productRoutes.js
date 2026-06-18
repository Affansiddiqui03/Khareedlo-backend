// Khareedlo Backend/routes/productRoutes.js
// UPDATED — buy_now_link added to all SELECT queries so frontend gets redirect link

const express = require("express");
const db      = require("../config/db");
const { resolveProductImage } = require("../utils/imageHelper");

const router = express.Router();
const APPROVED_ONLY = "p.status = 'APPROVED'";

// ── GET ALL PRODUCTS (public) ─────────────────────────────────
// Supports optional ?brand_id=X query param for Exchange picker (server-side filter)
router.get("/", (req, res) => {
  const { brand_id } = req.query;

  let whereClause = APPROVED_ONLY;
  const params = [];

  if (brand_id) {
    whereClause += " AND p.brand_id = ?";
    params.push(brand_id);
  }

  const sql = `
    SELECT
      p.product_id        AS id,
      p.product_name,
      p.product_name      AS title,
      p.price,
      p.gender            AS category,
      p.gender,
      p.image,
      p.brand_id,
      p.buy_now_link,
      p.avg_rating,
      p.rating_count,
      p.category_id,
      p.sub_category_id,
      c.category_name,
      s.sub_category_name,
      b.brand_name        AS brand,
      b.brand_name        AS brand_name,
      b.website           AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    LEFT JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
    WHERE ${whereClause}
    ORDER BY p.product_id DESC
  `;

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);

    const products = result.map(row => ({
      ...row,
      image: row.image && row.image !== "photos/" && row.image !== ""
        ? row.image
        : resolveProductImage(row.product_name),
      buy_now_link: row.buy_now_link || row.brand_website || null,
    }));

    res.json(products);
  });
});

// ── BRAND ROUTES (must come before /:id) ─────────────────────

router.get("/brand/:brandId", (req, res) => {
  const sql = `
    SELECT
      p.product_id        AS id,
      p.product_name,
      p.product_name      AS name,
      p.price,
      p.image,
      p.discount_price,
      p.gender,
      p.category_id,
      p.sub_category_id,
      p.buy_now_link,
      c.category_name,
      s.sub_category_name,
      b.brand_name        AS brand,
      b.website           AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    LEFT JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
    WHERE p.brand_id = ? AND ${APPROVED_ONLY}
    ORDER BY p.product_id DESC
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json(err);

    const products = result.map(p => ({
      ...p,
      image: p.image && p.image !== "photos/" && p.image !== ""
        ? p.image
        : resolveProductImage(p.product_name),
      buy_now_link: p.buy_now_link || p.brand_website || null,
    }));

    res.json(products);
  });
});

router.get("/brand/:brandId/seo", (req, res) => {
  const sql = `
    SELECT
      p.product_id   AS id,
      p.product_name,
      p.product_name AS name,
      p.price,
      p.image,
      p.gender,
      p.category_id,
      p.sub_category_id,
      p.buy_now_link,
      b.brand_name   AS brand,
      b.website      AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    WHERE p.brand_id = ? AND ${APPROVED_ONLY}
    ORDER BY p.product_id DESC, p.price ASC
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json(err);

    const products = result.map(p => ({
      ...p,
      image: p.image && p.image !== "photos/" && p.image !== ""
        ? p.image
        : resolveProductImage(p.product_name),
      buy_now_link: p.buy_now_link || p.brand_website || null,
    }));

    res.json(products);
  });
});

router.get("/brand/:brandId/filter", (req, res) => {
  const { category, sub } = req.query;

  let sql = `
    SELECT
      p.product_id   AS id,
      p.product_name,
      p.product_name AS name,
      p.price,
      p.image,
      p.discount_price,
      p.gender,
      p.buy_now_link,
      b.brand_name   AS brand,
      b.website      AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    WHERE p.brand_id = ? AND ${APPROVED_ONLY}
  `;

  const params = [req.params.brandId];
  if (category) { sql += " AND p.category_id = ?";     params.push(category); }
  if (sub)      { sql += " AND p.sub_category_id = ?"; params.push(sub);      }

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);

    const products = result.map(p => ({
      ...p,
      image: p.image && p.image !== "photos/" && p.image !== ""
        ? p.image
        : resolveProductImage(p.product_name),
      buy_now_link: p.buy_now_link || p.brand_website || null,
    }));

    res.json(products);
  });
});

router.get("/brand/:brandId/categories", (req, res) => {
  const sql = `
    SELECT DISTINCT c.category_id, c.category_name
    FROM products p
    JOIN categories c ON p.category_id = c.category_id
    WHERE p.brand_id = ? AND ${APPROVED_ONLY}
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

router.get("/brand/:brandId/subcategories/:categoryId", (req, res) => {
  const sql = `
    SELECT DISTINCT s.sub_category_id, s.sub_category_name
    FROM products p
    JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
    WHERE p.brand_id = ? AND p.category_id = ? AND ${APPROVED_ONLY}
  `;

  db.query(sql, [req.params.brandId, req.params.categoryId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ── SEARCH BY BRAND NAME (fallback for exchange picker) ──────
// GET /api/products/by-brand-name?name=Alkaram
router.get("/by-brand-name", (req, res) => {
  const { name } = req.query;
  if (!name) return res.json([]);

  const sql = `
    SELECT
      p.product_id        AS id,
      p.product_name,
      p.product_name      AS name,
      p.price,
      p.image,
      p.discount_price,
      p.gender,
      p.category_id,
      p.sub_category_id,
      p.buy_now_link,
      c.category_name,
      s.sub_category_name,
      b.brand_name        AS brand,
      b.brand_name        AS brand_name,
      b.website           AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    LEFT JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
    WHERE b.brand_name LIKE ? AND ${APPROVED_ONLY}
    ORDER BY p.product_id DESC
  `;

  db.query(sql, [`%${name}%`], (err, result) => {
    if (err) return res.status(500).json(err);
    const products = result.map(p => ({
      ...p,
      image: p.image && p.image !== "photos/" && p.image !== ""
        ? p.image
        : resolveProductImage(p.product_name),
      buy_now_link: p.buy_now_link || p.brand_website || null,
    }));
    res.json(products);
  });
});

// ── SINGLE PRODUCT (must be last) ────────────────────────────
router.get("/:id", (req, res) => {
  const sql = `
    SELECT
      p.product_id        AS id,
      p.product_name,
      p.product_name      AS title,
      p.price,
      p.gender            AS category,
      p.gender,
      p.image,
      p.brand_id,
      p.buy_now_link,
      p.category_id,
      p.sub_category_id,
      c.category_name,
      s.sub_category_name,
      b.brand_name        AS brand,
      b.website           AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    LEFT JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
    WHERE p.product_id = ? AND ${APPROVED_ONLY}
  `;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (!result.length) return res.status(404).json({ msg: "Product not found" });

    const row = result[0];
    const product = {
      ...row,
      image: row.image && row.image !== "photos/" && row.image !== ""
        ? row.image
        : resolveProductImage(row.product_name),
      buy_now_link: row.buy_now_link || row.brand_website || null,
    };

    res.json(product);
  });
});

module.exports = router;