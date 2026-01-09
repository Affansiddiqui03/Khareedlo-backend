const Brand = require("../models/Brand");
const Product = require("../models/Product");

exports.updateBrandInfo = async (req, res) => {
  try {
    const { brandId } = req.brandAdmin;

    const updated = await Brand.findByIdAndUpdate(brandId, req.body, { new: true });

    res.json(updated);
  } 
  catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { brandId } = req.brandAdmin;

    const product = await Product.create({
      ...req.body,
      brandId,
    });

    res.json(product);
  } 
  catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { brandId } = req.brandAdmin;
    const { id } = req.params;

    const product = await Product.findOneAndUpdate(
      { _id: id, brandId },
      req.body,
      { new: true }
    );

    res.json(product);
  } 
  catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { brandId } = req.brandAdmin;
    const { id } = req.params;

    await Product.findOneAndDelete({ _id: id, brandId });

    res.json({ msg: "Product deleted" });
  } 
  catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
