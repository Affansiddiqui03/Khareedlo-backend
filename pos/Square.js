const axios = require("axios");

const SQUARE_BASE_URL = "https://connect.squareup.com/v2";

async function fetchSquareProducts(token) {
  const res = await axios.post(
    `${SQUARE_BASE_URL}/catalog/search`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.objects;
}

module.exports = {
  fetchSquareProducts,
};
