const express = require("express");
const router = express.Router();
const RefundRequest = require("../models/RefundRequest");

// Create refund request
router.post("/", async (req, res) => {
  try {
    const refund = await RefundRequest.create(req.body);
    res.json(refund);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
