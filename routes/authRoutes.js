const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.post("/login", (req, res) => {
  const { email, password } = req.body;
const sql = `
  SELECT brand_id, brand_name, email
  FROM brands
  WHERE email = ? AND password = ?
`;


  db.query(sql, [email, password], (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });

    if (result.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

const brand = result[0];

res.json({
  brandId: brand.brand_id,
  name: brand.brand_name,  // Correct key here
  email: brand.email,
  role: "brand"
});

  });
});

module.exports = router;
