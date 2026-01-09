const express = require("express");
const Order = require("../models/Order");
const router = express.Router();

// Place order
router.post("/", async (req, res) => {
  const order = await Order.create(req.body);
  res.json(order);
});

// Orders by user
router.get("/user/:id", async (req, res) => {
  const orders = await Order.find({ userId: req.params.id });
  res.json(orders);
});

module.exports = router;
