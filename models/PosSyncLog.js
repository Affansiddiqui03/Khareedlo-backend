const mongoose = require("mongoose");

const PosSyncLogSchema = new mongoose.Schema({
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    required: true
  },

  posProvider: {
    type: String,
    enum: ["loyverse", "square", "shopify"],
    required: true
  },

  action: {
    type: String, // product_sync, order_push, stock_update
    required: true
  },

  status: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending"
  },

  message: {
    type: String,
    default: ""
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("PosSyncLog", PosSyncLogSchema);
