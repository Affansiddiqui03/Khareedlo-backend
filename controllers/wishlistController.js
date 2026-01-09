const User = require("../models/User");
const Product = require("../models/Product");

// Add item to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ msg: "Product not found" });

    const user = await User.findById(userId);

    // Already exists?
    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ msg: "Already in wishlist" });
    }

    user.wishlist.push(productId);
    await user.save();

    res.json({ msg: "Added to wishlist" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Remove item
exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    await User.findByIdAndUpdate(userId, {
      $pull: { wishlist: productId },
    });

    res.json({ msg: "Removed from wishlist" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Get full wishlist
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate("wishlist");

    res.json(user.wishlist);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
