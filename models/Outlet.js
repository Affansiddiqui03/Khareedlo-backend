const mongoose = require("mongoose");

const OutletSchema = new mongoose.Schema({
  outletName: { type: String, required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },
  city: { type: String, required: true },
  address: { type: String, required: true },

  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },

  phone: { type: String, default: "" },
  image: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now }
});

// Enable GEO Queries
OutletSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Outlet", OutletSchema);
