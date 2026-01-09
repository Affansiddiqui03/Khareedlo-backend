const Product = require("../models/Product");
const PosSyncLog = require("../models/PosSyncLog");
const Brand = require("../models/Brand");

exports.syncProductsToDB = async ({ brandId, provider, products }) => {
  try {

    // ✅ DEMO MODE CHECK (YAHAN LAGANA HAI)
    if (process.env.DEMO_MODE === "true") {
      return {
        success: true,
        message: "POS Sync simulated (Demo Mode)",
        syncedProducts: 12
      };
    }

    let syncedCount = 0;

    for (const item of products) {
      await Product.findOneAndUpdate(
        {
          sku: item.sku,
          brand: brandId
        },
        {
          title: item.name,
          price: item.price,
          stock: item.stock,
          sku: item.sku,
          brand: brandId,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      syncedCount++;
    }

    await PosSyncLog.create({
      brand: brandId,
      provider,
      action: "product_sync",
      status: "success",
      count: syncedCount
    });

    return { success: true, syncedCount };

  } catch (err) {
    await PosSyncLog.create({
      brand: brandId,
      provider,
      action: "product_sync",
      status: "failed",
      error: err.message
    });

    throw err;
  }
};
