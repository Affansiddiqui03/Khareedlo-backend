const fs = require("fs");
const path = require("path");

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveProductImage(productName) {
  const folder = path.join(__dirname, "..", "photos");
  if (!fs.existsSync(folder)) return null;

  const base = normalize(productName);

  const files = fs.readdirSync(folder);

  const match = files.find(f =>
    normalize(f).includes(base)
  );

  return match ? `photos/${match}` : null;
}

module.exports = { resolveProductImage };
