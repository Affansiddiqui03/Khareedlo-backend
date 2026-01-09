const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true, sparse: true }, // 🔥 sparse added
  price: Number,
  image: String,
  brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
  isActive: { type: Boolean, default: true },
});

productSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

productSchema.pre("insertMany", function (next, docs) {
  docs.forEach(doc => {
    if (!doc.slug && doc.title) {
      doc.slug = doc.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
  });
  next();
});

module.exports = mongoose.model("Product", productSchema);
