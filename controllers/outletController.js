const Outlet = require("../models/Outlet");

// Create outlet
exports.createOutlet = async (req, res) => {
  try {
    const outlet = await Outlet.create(req.body);
    res.json(outlet);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Get all outlets
exports.getOutlets = async (req, res) => {
  try {
    const outlets = await Outlet.find().populate("brand", "name logo");
    res.json(outlets);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Get single outlet
exports.getOutlet = async (req, res) => {
  try {
    const outlet = await Outlet.findById(req.params.id).populate(
      "brand",
      "name logo"
    );
    res.json(outlet);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Filter by city
exports.outletsByCity = async (req, res) => {
  try {
    const city = req.query.city;
    const outlets = await Outlet.find({ city });
    res.json(outlets);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Filter by brand
exports.outletsByBrand = async (req, res) => {
  try {
    const brandId = req.query.brand;
    const outlets = await Outlet.find({ brand: brandId });
    res.json(outlets);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.nearbyOutlets = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const outlets = await Outlet.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: 5000 // 5 km radius
        }
      }
    });

    res.json(outlets);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
