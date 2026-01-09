const router = require("express").Router();
const {
  trackView,
  trackWishlist,
  trackPurchase
} = require("../controllers/trackingController");

router.post("/:id/view", trackView);
router.post("/:id/wishlist", trackWishlist);
router.post("/:id/purchase", trackPurchase);

module.exports = router;
