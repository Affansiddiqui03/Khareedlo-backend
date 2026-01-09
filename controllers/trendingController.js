const Product = require("../models/Product");

exports.getTrendingProducts = async (req, res) => {
  try {
    const products = await Product.find().lean();

    // ⭐ Weightage (tuned for fashion marketplace)
    const W = {
      views: 0.2,
      wishlist: 0.4,
      purchases: 0.8,
      stock: 0.1,
      brandRating: 0.4
    };

    const scored = products.map(p => {
      const score =
        (p.views || 0) * W.views +
        (p.wishlistCount || 0) * W.wishlist +
        (p.purchaseCount || 0) * W.purchases +
        (p.stock || 0) * W.stock;

      return { ...p, trendingScore: score };
    });

    scored.sort((a, b) => b.trendingScore - a.trendingScore);

    res.json(scored.slice(0, 20)); // top 20 trending
  } catch (e) {
    res.status(500).json({ msg: "Error calculating trending" });
  }
};
