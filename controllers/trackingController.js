const Product = require("../models/Product");

exports.trackView = async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    res.json({ ok: true, views: p.views });
  } catch {
    res.status(500).json({ msg: "Error updating views" });
  }
};

exports.trackWishlist = async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { wishlistCount: 1 } },
      { new: true }
    );
    res.json({ ok: true, wishlistCount: p.wishlistCount });
  } catch {
    res.status(500).json({ msg: "Error updating wishlist" });
  }
};

exports.trackPurchase = async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { purchaseCount: 1 } },
      { new: true }
    );
    res.json({ ok: true, purchaseCount: p.purchaseCount });
  } catch {
    res.status(500).json({ msg: "Error updating purchase count" });
  }
};
