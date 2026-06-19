// routes/cartRoutes.js
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const User    = require("../models/User");

// GET /api/cart  — fetch this user's cart
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("cart");
    res.json(user?.cart || []);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// POST /api/cart/sync  — replace full cart (called on add/remove)
router.post("/sync", auth, async (req, res) => {
  try {
    const { cart } = req.body;  // full cart array from frontend
    if (!Array.isArray(cart)) return res.status(400).json({ msg: "cart must be an array" });

    await User.findByIdAndUpdate(req.user.id, { cart });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;