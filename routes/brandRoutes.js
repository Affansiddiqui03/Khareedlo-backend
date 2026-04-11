const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET ALL BRANDS
router.get("/", (req, res) => {
  const sql = `
    SELECT
      brand_id AS id,
      brand_name AS name,
      city,
      description,
      website,
      rating
    FROM brands
    WHERE status = 'APPROVED'  -- Only approved brands
    ORDER BY rating DESC  -- Order by rating descending
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }
    res.json(result);
  });
});

// GET SINGLE BRAND
router.get("/:id", (req, res) => {
  const sql = `
    SELECT
      brand_id AS id,
      brand_name AS name,
      description,
      website,
      rating
    FROM brands
    WHERE brand_id = ? AND status = 'APPROVED'  -- Only approved brands
  `;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    if (!result.length) return res.status(404).json({ msg: "Brand not found" });
    res.json(result[0]);
  });
});



module.exports = router;
