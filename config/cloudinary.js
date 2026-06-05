const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dvq9bh03k",
  api_key:    process.env.CLOUDINARY_API_KEY    || "113532156765553",
  api_secret: process.env.CLOUDINARY_API_SECRET || "XhSy7ctkUtXXt7YQgRKYVYZJYdY",
});

// ── Product Images ────────────────────────────────────────────
const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "khareedlo/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto" }],
  },
});

// ── Brand Logos ───────────────────────────────────────────────
const logoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "khareedlo/logos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "limit", quality: "auto" }],
  },
});

// ── Brand Banners ─────────────────────────────────────────────
const bannerStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "khareedlo/banners",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 400, crop: "limit", quality: "auto" }],
  },
});

const uploadProduct = multer({ storage: productStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadLogo    = multer({ storage: logoStorage,    limits: { fileSize: 3 * 1024 * 1024 } });
const uploadBanner  = multer({ storage: bannerStorage,  limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { cloudinary, uploadProduct, uploadLogo, uploadBanner };
