const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brandController");

// static
router.get("/public", brandController.getPublicBrands);

// dynamic
router.get("/:id", brandController.getBrandDetail);
router.get("/:id/products", brandController.getBrandProducts);

module.exports = router;
