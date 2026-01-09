const axios = require("axios");

const LOYVERSE_BASE_URL = "https://api.loyverse.com/v1.0";

async function fetchLoyverseProducts(apiKey) {
  const res = await axios.get(`${LOYVERSE_BASE_URL}/items`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  return res.data.items;
}

async function fetchLoyverseInventory(apiKey) {
  const res = await axios.get(`${LOYVERSE_BASE_URL}/inventory`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  return res.data.inventory_levels;
}

async function fetchLoyverseStores(apiKey) {
  const res = await axios.get(`${LOYVERSE_BASE_URL}/stores`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  return res.data.stores;
}

module.exports = {
  fetchLoyverseProducts,
  fetchLoyverseInventory,
  fetchLoyverseStores,
};
