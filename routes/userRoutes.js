const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const Product = require("../models/Product");

// =============================
// GET PROFILE
// =============================
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// =============================
// UPDATE PROFILE
// =============================
router.put("/update", auth, async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { new: true }
    ).select("-password");

    res.json({ msg: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// =============================
// GET WISHLIST
// =============================
router.get("/wishlist", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("wishlist");

    res.json(user.wishlist);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// =============================
// ADD TO WISHLIST
// =============================
router.post("/wishlist/add", auth, async (req, res) => {
  try {
    const { productId } = req.body;

    const user = await User.findById(req.user.id);

    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ msg: "Already in wishlist" });
    }

    user.wishlist.push(productId);
    await user.save();

    res.json({ msg: "Added to wishlist" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// =============================
// REMOVE FROM WISHLIST
// =============================
router.post("/wishlist/remove", auth, async (req, res) => {
  try {
    const { productId } = req.body;

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { wishlist: productId }
    });

    res.json({ msg: "Removed from wishlist" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// =============================
// USER ORDERS (DUMMY)
// =============================
router.get("/orders", auth, async (req, res) => {
  try {
    res.json({
      orders: [],
      note: "Real orders handled by brands. This API is for showing user order history synced from brands later."
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post("/track/brand", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.activityStats.visitedBrands += 1;
  await user.save();
  res.json({ success: true });
});

router.post("/track/product-click", auth, async (req, res) => {
  const { productName, brandName } = req.body;

  const user = await User.findById(req.user.id);
  user.activityStats.productClicks += 1;

  user.recentActivities.unshift({ productName, brandName });
  user.recentActivities = user.recentActivities.slice(0, 10);

  await user.save();
  res.json({ success: true });
});

router.post("/feedback", auth, async (req, res) => {
  const { message } = req.body;
  const user = await User.findById(req.user.id);
  user.feedbacks.push({ message });
  await user.save();
  res.json({ msg: "Feedback submitted" });
});

router.post("/track/buy-redirect", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.activityStats.buyRedirects += 1;
  await user.save();
  res.json({ success: true });
});
module.exports = router;
