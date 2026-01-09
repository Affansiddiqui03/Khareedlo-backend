const Product = require("../models/Product");

exports.calculateTrendingProducts = async () => {
  const products = await Product.find();

  const scoredProducts = products.map(p => {
    const daysOld =
      (Date.now() - new Date(p.updatedAt)) / (1000 * 60 * 60 * 24);

    const freshnessBonus = daysOld < 7 ? 20 : daysOld < 30 ? 10 : 0;

    const score =
      (p.views || 0) * 1 +
      (p.wishlistCount || 0) * 3 +
      (p.purchaseCount || 0) * 5 +
      freshnessBonus;

    return {
      product: p,
      score
    };
  });

  scoredProducts.sort((a, b) => b.score - a.score);

  return scoredProducts.slice(0, 15).map(p => p.product);
};
