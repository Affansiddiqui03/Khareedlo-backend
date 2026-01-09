const db = require("../config/db");

const getAllProducts = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, b.brand_name 
      FROM products p
      JOIN brands b ON p.brand_id = b.brand_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

const getProductById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM products WHERE product_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = { getAllProducts, getProductById };
