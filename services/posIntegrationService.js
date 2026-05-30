// Khareedlo Backend/services/posIntegrationService.js

const https = require("https");

// ── Generic HTTPS helper ─────────────────────────────────────
function apiRequest(hostname, path, method, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname, path, method,
      headers: {
        ...headers,
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 15000,
    };

    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", c => { data += c; });
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });

    req.on("error",   reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ════════════════════════════════════════
//  LOYVERSE — Alkaram (brand_id = 3)
//  Loyverse requires variant_id in every receipt line item.
//  Strategy: search catalog → if not found, create the item → use variant_id.
// ════════════════════════════════════════

async function getLoyverseVariantId(token, productName, unitPrice) {
  // Step 1: fetch all items
  const listResult = await apiRequest(
    "api.loyverse.com",
    "/v1.0/items?limit=250",
    "GET",
    { "Authorization": `Bearer ${token}` },
    null
  );

  if (listResult.status !== 200) {
    console.warn("[Loyverse] Items fetch failed:", listResult.status);
    return null;
  }

  const items = listResult.data?.items || [];
  console.log(`[Loyverse] Fetched ${items.length} catalog items`);

  // Strip brand prefix for matching: "ALKARAM - RTS BLENDED" → "RTS BLENDED"
  const search = (productName.includes(" - ")
    ? productName.split(" - ").slice(1).join(" - ")
    : productName
  ).toLowerCase().trim();

  let match = items.find(i => i.item_name?.toLowerCase().trim() === search)
    || items.find(i => i.item_name?.toLowerCase().includes(search) || search.includes(i.item_name?.toLowerCase() || ""));

  if (match?.variants?.[0]?.variant_id) {
    console.log(`[Loyverse] Found existing item "${match.item_name}": ${match.variants[0].variant_id}`);
    return match.variants[0].variant_id;
  }

  // Step 2: no match → create a new catalog item
  console.log(`[Loyverse] No matching item — creating catalog entry for "${productName}"`);

  const createResult = await apiRequest(
    "api.loyverse.com",
    "/v1.0/items",
    "POST",
    {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    {
      item_name: productName,
      variants: [
        {
          variant_name: "Default",
          price:        parseFloat(unitPrice) || 0,
          cost:         0,
          track_stock:  false,
        },
      ],
    }
  );

  console.log("[Loyverse] Create item response:", createResult.status, JSON.stringify(createResult.data).slice(0, 200));

  const variantId = createResult.data?.variants?.[0]?.variant_id
    || createResult.data?.item?.variants?.[0]?.variant_id;

  if (variantId) {
    console.log(`[Loyverse] Created new item, variant_id: ${variantId}`);
    return variantId;
  }

  console.warn("[Loyverse] Item creation did not return variant_id");
  return null;
}

async function getLoyverseStoreId(token) {
  try {
    const result = await apiRequest(
      "api.loyverse.com",
      "/v1.0/stores",
      "GET",
      { "Authorization": `Bearer ${token}` },
      null
    );

    if (result.status !== 200) {
      console.warn("[Loyverse] stores fetch failed:", result.status);
      return null;
    }

    const stores = result.data?.stores || [];
    const storeId = stores[0]?.id || null;
    console.log(`[Loyverse] Store id: ${storeId}`);
    return storeId;
  } catch (err) {
    console.warn("[Loyverse] stores error:", err.message);
    return null;
  }
}

async function getLoyverseCashPaymentTypeId(token) {
  try {
    const result = await apiRequest(
      "api.loyverse.com",
      "/v1.0/payment_types",
      "GET",
      { "Authorization": `Bearer ${token}` },
      null
    );

    if (result.status !== 200) {
      console.warn("[Loyverse] payment_types fetch failed:", result.status);
      return null;
    }

    const types = result.data?.payment_types || [];
    console.log("[Loyverse] Payment types:", types.map(t => `${t.name}(${t.id})`).join(", "));

    // Find cash-type payment — usually named "Cash" with type "CASH"
    const cash = types.find(t => t.type === "CASH")
      || types.find(t => t.name?.toLowerCase() === "cash")
      || types[0]; // fallback to first available

    return cash?.id || null;
  } catch (err) {
    console.warn("[Loyverse] payment_types error:", err.message);
    return null;
  }
}

async function createLoyverseReceipt(order) {
  const token = process.env.LOYVERSE_TOKEN;

  if (!token || token === "your_loyverse_token") {
    console.log("[Loyverse] Token missing — using simulated");
    return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true };
  }

  // Fetch variant_id, payment_type_id and store_id in parallel
  let variantId, paymentTypeId, storeId;
  try {
    [variantId, paymentTypeId, storeId] = await Promise.all([
      getLoyverseVariantId(token, order.product_name, order.unit_price),
      getLoyverseCashPaymentTypeId(token),
      getLoyverseStoreId(token),
    ]);
  } catch (err) {
    console.warn("[Loyverse] Setup error:", err.message);
  }

  if (!variantId) {
    console.warn("[Loyverse] No variant_id — falling back to simulated");
    return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true };
  }

  if (!paymentTypeId) {
    console.warn("[Loyverse] No payment_type_id — falling back to simulated");
    return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true };
  }

  if (!storeId) {
    console.warn("[Loyverse] No store_id — falling back to simulated");
    return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true };
  }

  const receiptBody = {
    receipt_date: new Date().toISOString(),
    source:       "SALE",
    store_id:     storeId,
    line_items: [
      {
        variant_id:  variantId,
        quantity:    order.quantity,
        price:       parseFloat(order.unit_price),
        total_money: parseFloat(order.total_price),
        note:        `Khareedlo Platform | Customer: ${order.customer_id || "Guest"}`,
      },
    ],
    total_money: parseFloat(order.total_price),
    note:        `Khareedlo redirect order — ${order.product_name}`,
    payments: [
      {
        payment_type_id: paymentTypeId,
        money_amount:    parseFloat(order.total_price),
      },
    ],
  };

  console.log("[Loyverse] Creating receipt:", JSON.stringify(receiptBody));

  try {
    const result = await apiRequest(
      "api.loyverse.com",
      "/v1.0/receipts",
      "POST",
      {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      receiptBody
    );

    console.log("[Loyverse] Receipt response:", result.status, JSON.stringify(result.data));

    if (result.status === 200 || result.status === 201) {
      const receiptId = result.data?.receipts?.[0]?.receipt_number
        || result.data?.receipt_number
        || result.data?.id
        || `LYV-${Date.now()}`;
      return { success: true, loyverse_order_id: receiptId };
    }

    console.error("[Loyverse] API error:", result.status, result.data);
    return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true };

  } catch (err) {
    console.error("[Loyverse] Request error:", err.message);
    return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true };
  }
}

// ════════════════════════════════════════
//  SQUARE SANDBOX — Limelight (brand_id = 4)
//  Creates an order then attaches a CASH payment to move it to COMPLETED.
//  CASH payments in Square require cash_details.buyer_supplied_money.
// ════════════════════════════════════════
async function createSquareOrder(order) {
  const token    = process.env.SQUARE_ACCESS_TOKEN;
  const location = process.env.SQUARE_LOCATION_ID;

  if (!token || token === "your_square_token" || !location) {
    console.log("[Square] Credentials missing — using simulated");
    return { success: true, square_order_id: `SQ-DEMO-${Date.now()}`, simulated: true };
  }

  // Square amounts are in the smallest currency unit (cents for USD)
  const amountCents = Math.round(parseFloat(order.total_price) * 100);
  const unitCents   = Math.round(parseFloat(order.unit_price)  * 100);

  const orderBody = {
    idempotency_key: `khr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order: {
      location_id:  location,
      reference_id: `KHR-${Date.now()}`,
      line_items: [
        {
          name:     order.product_name,
          quantity: String(order.quantity),
          note:     `Khareedlo Platform | Customer: ${order.customer_id || "Guest"}`,
          base_price_money: {
            amount:   unitCents,
            currency: "USD",
          },
        },
      ],
      metadata: {
        source:         "khareedlo_platform",
        customer_id:    String(order.customer_id || "guest"),
        original_price: `PKR ${order.total_price}`,
      },
    },
  };

  console.log("[Square] Creating order:", JSON.stringify(orderBody));

  const squareHeaders = {
    "Authorization":  `Bearer ${token}`,
    "Content-Type":   "application/json",
    "Square-Version": "2024-01-17",
  };

  try {
    const orderResult = await apiRequest(
      "connect.squareupsandbox.com",
      "/v2/orders",
      "POST",
      squareHeaders,
      orderBody
    );

    console.log("[Square] Order response:", orderResult.status, JSON.stringify(orderResult.data).slice(0, 300));

    if (orderResult.status !== 200 && orderResult.status !== 201) {
      console.error("[Square] Order failed:", orderResult.status, orderResult.data?.errors);
      return { success: true, square_order_id: `SQ-DEMO-${Date.now()}`, simulated: true };
    }

    const orderId = orderResult.data?.order?.id;

    // Attach a CASH payment → order moves to COMPLETED and appears in dashboard
    // Square requires cash_details.buyer_supplied_money for CASH source
    const paymentBody = {
      idempotency_key: `khr-pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source_id:       "CASH",
      amount_money: {
        amount:   amountCents,
        currency: "USD",
      },
      cash_details: {
        buyer_supplied_money: {
          amount:   amountCents,
          currency: "USD",
        },
      },
      order_id:    orderId,
      location_id: location,
      note:        `Khareedlo Platform | Customer: ${order.customer_id || "Guest"}`,
    };

    console.log("[Square] Creating payment for order:", orderId);

    const payResult = await apiRequest(
      "connect.squareupsandbox.com",
      "/v2/payments",
      "POST",
      squareHeaders,
      paymentBody
    );

    console.log("[Square] Payment response:", payResult.status, JSON.stringify(payResult.data).slice(0, 300));

    if (payResult.status === 200 || payResult.status === 201) {
      const paymentId = payResult.data?.payment?.id;
      console.log(`[Square] Order ${orderId} completed with payment ${paymentId}`);
      return { success: true, square_order_id: orderId };
    }

    // Payment failed but order exists — return the order id anyway
    console.warn("[Square] Payment failed, order exists:", payResult.status, payResult.data?.errors);
    return { success: true, square_order_id: orderId };

  } catch (err) {
    console.error("[Square] Request error:", err.message);
    return { success: true, square_order_id: `SQ-DEMO-${Date.now()}`, simulated: true };
  }
}

// ════════════════════════════════════════
//  DISPATCHER
// ════════════════════════════════════════
async function saveToExternalPOS(brandId, order) {
  const result = { loyverse_order_id: null, square_order_id: null };

  if (Number(brandId) === 3) {
    const resp = await createLoyverseReceipt(order);
    if (resp.success)   result.loyverse_order_id = resp.loyverse_order_id;
    if (resp.simulated) result.loyverse_simulated = true;

  } else if (Number(brandId) === 4) {
    const resp = await createSquareOrder(order);
    if (resp.success)   result.square_order_id = resp.square_order_id;
    if (resp.simulated) result.square_simulated = true;
  }

  return result;
}

module.exports = { saveToExternalPOS, createLoyverseReceipt, createSquareOrder };
