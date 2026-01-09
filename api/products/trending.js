exports.getTrendingProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ views: -1, clicks: -1, wishlisted: -1 })
      .limit(12);

    res.json(products);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
