const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // ✅ Updated role field
  role: {
    type: String,
    enum: ["customer", "brand", "admin"],  // updated values
    default: "customer",                   // default to customer
  },

  // ✅ New status field
  status: {
    type: String,
    enum: ["pending", "approved"],        // only these two options
    default: "approved",                  // default to approved
  },

  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

  createdAt: { type: Date, default: Date.now },

  activityStats: {
  visitedBrands: { type: Number, default: 0 },
  productClicks: { type: Number, default: 0 },
  buyRedirects: { type: Number, default: 0 }
},
recentActivities: [
  {
    productName: String,
    brandName: String,
    visitedAt: { type: Date, default: Date.now }
  }
],
feedbacks: [
  {
    message: String,
    createdAt: { type: Date, default: Date.now }
  }
]
});


module.exports = mongoose.model("User", UserSchema);
