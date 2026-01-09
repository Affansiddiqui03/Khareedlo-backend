const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, sparse: true }, // 🔥 sparse
  logo: String,
  category: String,
  city: String,
  description: String,
});

brandSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

brandSchema.pre("insertMany", function (next, docs) {
  docs.forEach(doc => {
    if (!doc.slug && doc.name) {
      doc.slug = doc.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
  });
  next();
});

module.exports = mongoose.model("Brand", brandSchema);
