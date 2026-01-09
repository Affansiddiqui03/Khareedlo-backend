const mongoose = require("mongoose");

const BrandPOSSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    required: true,
  },

  provider: {
    type: String,
    enum: ["LOYVERSE", "SQUARE"],
    required: true,
  },

  apiKey: { type: String, required: true },

  storeId: String,
  isActive: { type: Boolean, default: true },

  lastSyncedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model("BrandPOS", BrandPOSSchema);
