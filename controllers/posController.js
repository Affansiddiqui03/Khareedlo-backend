const loyverse = require("../pos/Loyverse");
const square = require("../pos/Square");

exports.syncProducts = async (req, res) => {
  const { provider, apiKey } = req.body;

  try {
    let products = [];

    if (provider === "LOYVERSE") {
      products = await loyverse.fetchLoyverseProducts(apiKey);
    }

    if (provider === "SQUARE") {
      products = await square.fetchSquareProducts(apiKey);
    }

    // Yahan future mein:
    // Save products into DB

    res.json({
      success: true,
      count: products.length,
      products,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
