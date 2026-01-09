// routes/brandProfileRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/:brandId", (req, res) => {
  const sql = `SELECT name, email, contact, city, address, description, website 
               FROM brands WHERE brand_id = ?`;

  db.query(sql, [req.params.brandId], (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(result[0]);
  });
});

router.put("/:brandId", (req, res) => {
  const { contact, city, address, description, website } = req.body;

  const sql = `
    UPDATE brands 
    SET contact=?, city=?, address=?, description=?, website=?
    WHERE brand_id=?
  `;

  db.query(sql, [contact, city, address, description, website, req.params.brandId],
    (err) => {
      if (err) return res.status(500).json({ error: "Update failed" });
      res.json({ success: true });
    }
  );
});

module.exports = router;
