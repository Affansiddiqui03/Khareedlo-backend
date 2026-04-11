const express = require("express");
const db = require("../config/db");
const { resolveProductImage } = require("../utils/imageHelper");

const router = express.Router();

/* =========================
   GET ALL PRODUCTS
========================= */
router.get("/", (req, res) => {
  const sql = `
    SELECT 
      p.product_id AS id,
      p.product_name,
      p.product_name AS title,
      p.price,
      p.gender AS category,
      p.image,
      p.brand_id,
      b.brand_name AS brand,
      b.website AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    ORDER BY p.product_id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);

    const products = result.map(row => ({
      ...row,
      image:
        row.image &&
        row.image !== "photos/" &&
        row.image !== ""
          ? row.image
          : resolveProductImage(row.product_name)
    }));

    res.json(products);
  });
});

/* =========================
   GET SINGLE PRODUCT
========================= */
router.get("/:id", (req, res) => {
  const sql = `
    SELECT 
      p.product_id AS id,
      p.product_name,
      p.product_name AS title,
      p.price,
      p.gender AS category,
      p.image,
      p.brand_id,
      b.brand_name AS brand,
      b.website AS brand_website
    FROM products p
    JOIN brands b ON p.brand_id = b.brand_id
    WHERE p.product_id = ?
  `;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (!result.length)
      return res.status(404).json({ msg: "Product not found" });

    const product = {
      ...result[0],
      image:
        result[0].image &&
        result[0].image !== "photos/" &&
        result[0].image !== ""
          ? result[0].image
          : resolveProductImage(result[0].product_name)
    };

    res.json(product);
  });
});

/* =========================
   GET PRODUCTS BY BRAND
========================= */
router.get("/brand/:brandId", (req, res) => {
  const sql = `
    SELECT 
      p.product_id AS id,
      p.product_name,
      p.product_name AS name,
      p.price,
      p.image,
      p.discount_price,
      p.gender,
      p.category_id,
      p.sub_category_id
    FROM products p
    WHERE p.brand_id = ?
    ORDER BY p.product_id DESC
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json(err);

    const products = result.map(p => ({
      ...p,
      image:
        p.image &&
        p.image !== "photos/" &&
        p.image !== ""
          ? p.image
          : resolveProductImage(p.product_name)
    }));

    res.json(products);
  });
});

/* =========================
   ADD PRODUCT
========================= */
router.post("/", (req, res) => {
  const { name, price, stock, category, description, image, brand_id } =
    req.body;

  const sql = `
    INSERT INTO products
      (product_name, price, stock, category_id, description, image, brand_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [name, price, stock, category, description, image, brand_id],
    err => {
      if (err) return res.status(500).json({ error: "Insert failed" });
      res.json({ success: true });
    }
  );
});

/* =========================
   DELETE PRODUCT
========================= */
router.delete("/:id", (req, res) => {
  db.query(
    "DELETE FROM products WHERE product_id = ?",
    [req.params.id],
    err => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

/* =========================
   GET PRODUCTS BY BRAND (SEO)
========================= */
router.get("/brand/:brandId/seo", (req, res) => {
  const sql = `
    SELECT 
      p.product_id AS id,
      p.product_name,
      p.product_name AS name,
      p.price,
      p.image,
      p.gender,
      p.category_id,
      p.sub_category_id
    FROM products p
    WHERE p.brand_id = ?
    ORDER BY p.product_id DESC, p.price ASC
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json(err);

    const products = result.map(p => ({
      ...p,
      image:
        p.image && p.image !== "photos/" && p.image !== ""
          ? p.image
          : resolveProductImage(p.product_name)
    }));

    res.json(products);
  });
});

/* =========================
   FILTER PRODUCTS BY BRAND
========================= */
router.get("/brand/:brandId/filter", (req, res) => {
  const { category, sub } = req.query;

  let sql = `
    SELECT 
      p.product_id AS id,
      p.product_name,
      p.product_name AS name,
      p.price,
      p.image,
      p.discount_price,
      p.gender
    FROM products p
    WHERE p.brand_id = ?
  `;

  const params = [req.params.brandId];

  if (category) {
    sql += " AND p.category_id = ?";
    params.push(category);
  }

  if (sub) {
    sql += " AND p.sub_category_id = ?";
    params.push(sub);
  }

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);

    const products = result.map(p => ({
      ...p,
      image:
        p.image &&
        p.image !== "photos/" &&
        p.image !== ""
          ? p.image
          : resolveProductImage(p.product_name)
    }));

    res.json(products);
  });
});

router.get("/brand/:brandId/categories", (req, res) => {
  const sql = `
    SELECT DISTINCT
      c.category_id,
      c.category_name
    FROM products p
    JOIN categories c ON p.category_id = c.category_id
    WHERE p.brand_id = ?
  `;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});
router.get("/brand/:brandId/subcategories/:categoryId", (req, res) => {
  const sql = `
    SELECT DISTINCT
      s.sub_category_id,
      s.sub_category_name
    FROM products p
    JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
    WHERE p.brand_id = ? AND p.category_id = ?
  `;

  db.query(sql, [req.params.brandId, req.params.categoryId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});
module.exports = router;
