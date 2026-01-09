const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },

  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      quantity: Number,
      price: Number
    }
  ],

  totalAmount: Number,

  externalOrderId: String, // from brand POS

  status: {
    type: String,
    enum: ["placed", "processing", "refunded", "cancelled"],
    default: "placed"
  },

  posSynced: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Order", OrderSchema);
