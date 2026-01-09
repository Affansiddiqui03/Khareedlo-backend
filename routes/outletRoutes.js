const express = require("express");
const Outlet = require("../models/Outlet");
const router = express.Router();

// Add outlet
router.post("/", async (req, res) => {
  const outlet = await Outlet.create(req.body);
  res.json(outlet);
});

// Nearby outlets
router.get("/nearby", async (req, res) => {
  const { lng, lat } = req.query;

  const outlets = await Outlet.find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: 5000
      }
    }
  });

  res.json(outlets);
});

module.exports = router;
