const Brand = require("../models/Brand");
const Product = require("../models/Product");
exports.getPublicBrands = async (req, res) => {
  const brands = await Brand.find();
  res.json(brands);
};

exports.getBrandDetail = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ msg: "Invalid ID" });

  const brand = await Brand.findById(req.params.id);
  res.json(brand);
};

exports.getBrandProducts = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return res.json([]);

  const products = await Product.find({ brand: req.params.id });
  res.json(products);
};
