const BrandAdmin = require("../models/BrandAdmin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.brandLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await BrandAdmin.findOne({ email });
    if (!admin) return res.status(400).json({ msg: "Brand admin not found" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ msg: "Invalid password" });

    const token = jwt.sign(
      { id: admin._id, role: "brand-admin", brandId: admin.brandId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        role: "brand-admin",
        brandId: admin.brandId,
      }
    });
  } 
  catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
