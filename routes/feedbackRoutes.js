const express = require("express");
const router = express.Router();
const db = require("../config/db");

// SAVE FEEDBACK
router.post("/", (req, res) => {
  const { user, message } = req.body;

  const sql = `
    INSERT INTO feedback (user_id, user_email, message)
    VALUES (?,?,?)
  `;

  db.query(
    sql,
    [user.id, user.email, message],
    () => res.json({ success: true })
  );
});

// ADMIN VIEW FEEDBACK
router.get("/", (req, res) => {
  db.query(
    "SELECT * FROM feedback ORDER BY created_at DESC",
    (err, result) => res.json(result)
  );
});

module.exports = router;
