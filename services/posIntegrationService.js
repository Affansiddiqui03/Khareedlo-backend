// Khareedlo Backend/services/posIntegrationService.js
// ══════════════════════════════════════════════════════
// Loyverse  → Alkaram   (brand_id = 3)
// Square    → Limelight (brand_id = 4)
//
// IMPORTANT — Square lifecycle:
//   Create order  → attach CASH payment → order becomes COMPLETED
//   Cancel/Void   → COMPLETED orders CANNOT be cancelled via /v2/orders/{id}/cancel
//                   They MUST be reversed via /v2/refunds (same endpoint for all 3 reasons)
//   So for Square: cancel, refund, AND exchange all use /v2/refunds
//
// IMPORTANT — Loyverse lifecycle:
//   Create receipt → DELETE /v1.0/receipts/{id} voids it (works for all 3 reasons)
// ══════════════════════════════════════════════════════

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
//  Strategy: search catalog for variant_id → if not found, create item → create receipt
// ════════════════════════════════════════

async function getLoyverseVariantId(token, productName, unitPrice) {
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

  // Strip brand prefix: "ALKARAM - RTS BLENDED" → "RTS BLENDED"
  const search = (productName.includes(" - ")
    ? productName.split(" - ").slice(1).join(" - ")
    : productName
  ).toLowerCase().trim();

  let match = items.find(i => i.item_name?.toLowerCase().trim() === search)
    || items.find(i => i.item_name?.toLowerCase().includes(search) || search.includes(i.item_name?.toLowerCase() || ""));

  if (match?.variants?.[0]?.variant_id) {
    console.log(`[Loyverse] Found item "${match.item_name}": ${match.variants[0].variant_id}`);
    return match.variants[0].variant_id;
  }

  // Not found → create catalog item
  console.log(`[Loyverse] Creating catalog entry for "${productName}"`);
  const createResult = await apiRequest(
    "api.loyverse.com",
    "/v1.0/items",
    "POST",
    { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    {
      item_name: productName,
      variants: [{ variant_name: "Default", price: parseFloat(unitPrice) || 0, cost: 0, track_stock: false }],
    }
  );

  console.log("[Loyverse] Create item response:", createResult.status, JSON.stringify(createResult.data).slice(0, 200));

  const variantId = createResult.data?.variants?.[0]?.variant_id
    || createResult.data?.item?.variants?.[0]?.variant_id;

  if (variantId) {
    console.log(`[Loyverse] Created item, variant_id: ${variantId}`);
    return variantId;
  }

  console.warn("[Loyverse] Item creation did not return variant_id");
  return null;
}

async function getLoyverseStoreId(token) {
  try {
    const result = await apiRequest("api.loyverse.com", "/v1.0/stores", "GET", { "Authorization": `Bearer ${token}` }, null);
    if (result.status !== 200) { console.warn("[Loyverse] stores fetch failed:", result.status); return null; }
    const storeId = result.data?.stores?.[0]?.id || null;
    console.log(`[Loyverse] Store id: ${storeId}`);
    return storeId;
  } catch (err) { console.warn("[Loyverse] stores error:", err.message); return null; }
}

async function getLoyverseCashPaymentTypeId(token) {
  try {
    const result = await apiRequest("api.loyverse.com", "/v1.0/payment_types", "GET", { "Authorization": `Bearer ${token}` }, null);
    if (result.status !== 200) { console.warn("[Loyverse] payment_types failed:", result.status); return null; }
    const types = result.data?.payment_types || [];
    console.log("[Loyverse] Payment types:", types.map(t => `${t.name}(${t.id})`).join(", "));
    const cash = types.find(t => t.type === "CASH") || types.find(t => t.name?.toLowerCase() === "cash") || types[0];
    return cash?.id || null;
  } catch (err) { console.warn("[Loyverse] payment_types error:", err.message); return null; }
}

async function createLoyverseReceipt(order) {
  const token = process.env.LOYVERSE_TOKEN;

  if (!token || token === "your_loyverse_token") {
    console.log("[Loyverse] Token missing — simulated");
    return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true };
  }

  let variantId, paymentTypeId, storeId;
  try {
    [variantId, paymentTypeId, storeId] = await Promise.all([
      getLoyverseVariantId(token, order.product_name, order.unit_price),
      getLoyverseCashPaymentTypeId(token),
      getLoyverseStoreId(token),
    ]);
  } catch (err) { console.warn("[Loyverse] Setup error:", err.message); }

  if (!variantId)      { console.warn("[Loyverse] No variant_id — simulated");      return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true }; }
  if (!paymentTypeId)  { console.warn("[Loyverse] No payment_type_id — simulated"); return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true }; }
  if (!storeId)        { console.warn("[Loyverse] No store_id — simulated");        return { success: true, loyverse_order_id: `LYV-DEMO-${Date.now()}`, simulated: true }; }

  const receiptBody = {
    receipt_date: new Date().toISOString(),
    source:       "SALE",
    store_id:     storeId,
    line_items: [{
      variant_id:  variantId,
      quantity:    order.quantity,
      price:       parseFloat(order.unit_price),
      total_money: parseFloat(order.total_price),
      note:        `Khareedlo | Customer: ${order.customer_id || "Guest"}`,
    }],
    total_money: parseFloat(order.total_price),
    note:        `Khareedlo order — ${order.product_name}`,
    payments: [{ payment_type_id: paymentTypeId, money_amount: parseFloat(order.total_price) }],
  };

  console.log("[Loyverse] Creating receipt:", JSON.stringify(receiptBody));

  try {
    const result = await apiRequest(
      "api.loyverse.com", "/v1.0/receipts", "POST",
      { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      receiptBody
    );
    console.log("[Loyverse] Receipt response:", result.status, JSON.stringify(result.data));

    if ([200, 201].includes(result.status)) {
      const receiptId = result.data?.receipts?.[0]?.receipt_number || result.data?.receipt_number || result.data?.id || `LYV-${Date.now()}`;
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
//  LOYVERSE — VOID receipt
//  Used for: cancel, refund, AND exchange (all reverse the receipt the same way)
//  Loyverse API: DELETE /v1.0/receipts/{receipt_number}
// ════════════════════════════════════════
async function voidLoyverseReceipt(loyverseOrderId) {
  const token = process.env.LOYVERSE_TOKEN;

  if (!token || token === "your_loyverse_token") {
    console.log("[Loyverse Void] No token — simulated void:", loyverseOrderId);
    return { success: true, simulated: true };
  }
  if (String(loyverseOrderId).startsWith("LYV-DEMO-")) {
    console.log("[Loyverse Void] Demo ID — skipping:", loyverseOrderId);
    return { success: true, simulated: true };
  }

  try {
    console.log("[Loyverse Void] Voiding:", loyverseOrderId);
    const result = await apiRequest(
      "api.loyverse.com",
      `/v1.0/receipts/${encodeURIComponent(loyverseOrderId)}`,
      "DELETE",
      { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      null
    );
    console.log("[Loyverse Void] Response:", result.status, JSON.stringify(result.data).slice(0, 200));

    if ([200, 204, 404].includes(result.status)) return { success: true };

    console.error("[Loyverse Void] Failed:", result.status, result.data);
    return { success: false, error: `Loyverse returned ${result.status}` };
  } catch (err) {
    console.error("[Loyverse Void] Error:", err.message);
    return { success: false, error: err.message };
  }
}

// ════════════════════════════════════════
//  SQUARE SANDBOX — Limelight (brand_id = 4)
//
//  PKR / USD note:
//    Square Sandbox only accepts USD. We store PKR amount in metadata.
//    We send PKR value as USD "cents" (e.g. PKR 3500 → 3500 cents = $35.00 in sandbox).
//    This is a sandbox workaround only — in production with a real PKR Square account
//    change currency to "PKR".
// ════════════════════════════════════════
async function createSquareOrder(order) {
  const token    = process.env.SQUARE_ACCESS_TOKEN;
  const location = process.env.SQUARE_LOCATION_ID;

  if (!token || token === "your_square_token" || !location) {
    console.log("[Square] Credentials missing — simulated");
    return { success: true, square_order_id: `SQ-DEMO-${Date.now()}`, simulated: true };
  }

  // PKR amount used directly as cents (sandbox workaround)
  const amountCents = Math.round(parseFloat(order.total_price));
  const unitCents   = Math.round(parseFloat(order.unit_price));

  const squareHeaders = {
    "Authorization":  `Bearer ${token}`,
    "Content-Type":   "application/json",
    "Square-Version": "2024-01-17",
  };

  const orderBody = {
    idempotency_key: `khr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order: {
      location_id:  location,
      reference_id: `KHR-${Date.now()}`,
      line_items: [{
        name:     order.product_name,
        quantity: String(order.quantity),
        note:     `Khareedlo | Customer: ${order.customer_id || "Guest"}`,
        base_price_money: { amount: unitCents, currency: "USD" },
      }],
      metadata: {
        source:          "khareedlo_platform",
        customer_id:     String(order.customer_id || "guest"),
        currency_actual: "PKR",
        price_pkr:       String(order.total_price),
        unit_price_pkr:  String(order.unit_price),
      },
    },
  };

  console.log("[Square] Creating order:", JSON.stringify(orderBody));

  try {
    const orderResult = await apiRequest("connect.squareupsandbox.com", "/v2/orders", "POST", squareHeaders, orderBody);
    console.log("[Square] Order response:", orderResult.status, JSON.stringify(orderResult.data).slice(0, 300));

    if (![200, 201].includes(orderResult.status)) {
      console.error("[Square] Order failed:", orderResult.status, orderResult.data?.errors);
      return { success: true, square_order_id: `SQ-DEMO-${Date.now()}`, simulated: true };
    }

    const orderId = orderResult.data?.order?.id;

    // Attach CASH payment → order moves to COMPLETED (appears in dashboard)
    const paymentBody = {
      idempotency_key: `khr-pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source_id:       "CASH",
      amount_money:         { amount: amountCents, currency: "USD" },
      cash_details: {
        buyer_supplied_money: { amount: amountCents, currency: "USD" },
      },
      order_id:    orderId,
      location_id: location,
      note:        `Khareedlo | Customer: ${order.customer_id || "Guest"} | PKR ${order.total_price}`,
    };

    console.log("[Square] Creating payment for order:", orderId);
    const payResult = await apiRequest("connect.squareupsandbox.com", "/v2/payments", "POST", squareHeaders, paymentBody);
    console.log("[Square] Payment response:", payResult.status, JSON.stringify(payResult.data).slice(0, 300));

    if ([200, 201].includes(payResult.status)) {
      const paymentId = payResult.data?.payment?.id;
      console.log(`[Square] ✅ Order ${orderId} COMPLETED with payment ${paymentId}`);
      return { success: true, square_order_id: orderId, square_payment_id: paymentId };
    }

    console.warn("[Square] Payment failed, order exists:", payResult.status, payResult.data?.errors);
    return { success: true, square_order_id: orderId };

  } catch (err) {
    console.error("[Square] Request error:", err.message);
    return { success: true, square_order_id: `SQ-DEMO-${Date.now()}`, simulated: true };
  }
}

// ════════════════════════════════════════
//  SQUARE — REVERSE a COMPLETED order
//  Used for: cancel, refund, AND exchange
//
//  WHY: Once a CASH payment is attached, Square order becomes COMPLETED.
//  COMPLETED orders CANNOT be cancelled via /v2/orders/{id}/cancel (returns 400).
//  The ONLY way to reverse them is via /v2/refunds.
//
//  Strategy:
//    1. If we have payment_id in hand → refund directly
//    2. Otherwise → GET /v2/orders/{id} → read tenders[0].id
//    3. Fallback → GET /v2/payments?order_id={id} → payments[0].id
//    4. Issue POST /v2/refunds with that payment_id
// ════════════════════════════════════════
async function reverseSquareOrder(squareOrderId, totalPrice, squarePaymentId) {
  const token    = process.env.SQUARE_ACCESS_TOKEN;
  const location = process.env.SQUARE_LOCATION_ID;

  if (!token || token === "your_square_token" || !location) {
    console.log("[Square Reverse] Credentials missing — simulated for:", squareOrderId);
    return { success: true, simulated: true };
  }
  if (String(squareOrderId).startsWith("SQ-DEMO-")) {
    console.log("[Square Reverse] Demo ID — skipping:", squareOrderId);
    return { success: true, simulated: true };
  }

  const squareHeaders = {
    "Authorization":  `Bearer ${token}`,
    "Content-Type":   "application/json",
    "Square-Version": "2024-01-17",
  };

  let paymentId = squarePaymentId || null;

  // Step 1: if no payment_id passed in, fetch from order
  if (!paymentId) {
    try {
      console.log("[Square Reverse] Fetching order to get payment_id:", squareOrderId);
      const orderResult = await apiRequest(
        "connect.squareupsandbox.com",
        `/v2/orders/${squareOrderId}`,
        "GET",
        squareHeaders,
        null
      );
      if (orderResult.status === 200) {
        const tenders = orderResult.data?.order?.tenders || [];
        paymentId = tenders[0]?.id || null;
        console.log("[Square Reverse] payment_id from order tenders:", paymentId);
      }
    } catch (err) { console.warn("[Square Reverse] Order fetch error:", err.message); }
  }

  // Step 2: fallback — query payments list
  if (!paymentId) {
    try {
      console.log("[Square Reverse] Fetching payments list for order:", squareOrderId);
      const paymentsResult = await apiRequest(
        "connect.squareupsandbox.com",
        `/v2/payments?order_id=${squareOrderId}`,
        "GET",
        { "Authorization": `Bearer ${token}`, "Square-Version": "2024-01-17" },
        null
      );
      if (paymentsResult.status === 200) {
        const payments = paymentsResult.data?.payments || [];
        paymentId = payments[0]?.id || null;
        console.log("[Square Reverse] payment_id from payments list:", paymentId);
      }
    } catch (err) { console.warn("[Square Reverse] Payments list error:", err.message); }
  }

  if (!paymentId) {
    console.error("[Square Reverse] Could not find payment_id for order:", squareOrderId);
    return { success: false, error: "payment_id not found — order may not have been paid" };
  }

  // Step 3: Issue the refund via /v2/refunds
  const amountCents = Math.round(parseFloat(totalPrice)); // PKR as cents (sandbox)
  const refundBody = {
    idempotency_key: `khr-rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payment_id:      paymentId,
    amount_money:    { amount: amountCents, currency: "USD" },
    reason:          "Khareedlo — customer reversal",
  };

  console.log("[Square Reverse] Issuing refund via /v2/refunds:", JSON.stringify(refundBody));

  try {
    const refundResult = await apiRequest(
      "connect.squareupsandbox.com",
      "/v2/refunds",
      "POST",
      squareHeaders,
      refundBody
    );
    console.log("[Square Reverse] Refund response:", refundResult.status, JSON.stringify(refundResult.data).slice(0, 300));

    if ([200, 201].includes(refundResult.status)) {
      const refundId = refundResult.data?.refund?.id;
      console.log("[Square Reverse] ✅ Refund issued:", refundId);
      return { success: true, refund_id: refundId };
    }

    // 400 with AMOUNT_TOO_HIGH or already refunded → treat as success (money already back)
    const errCodes = refundResult.data?.errors?.map(e => e.code) || [];
    if (refundResult.status === 400 && (errCodes.includes("AMOUNT_TOO_HIGH") || errCodes.includes("PAYMENT_ALREADY_COMPLETED"))) {
      console.warn("[Square Reverse] Already reversed:", errCodes);
      return { success: true, simulated: true };
    }

    console.error("[Square Reverse] Failed:", refundResult.status, refundResult.data?.errors);
    return { success: false, error: `Square returned ${refundResult.status}` };

  } catch (err) {
    console.error("[Square Reverse] Error:", err.message);
    return { success: false, error: err.message };
  }
}

// ════════════════════════════════════════
//  DISPATCHER — CREATE ORDER
// ════════════════════════════════════════
async function saveToExternalPOS(brandId, order) {
  const result = { loyverse_order_id: null, square_order_id: null };

  if (Number(brandId) === 3) {
    const resp = await createLoyverseReceipt(order);
    if (resp.success)   result.loyverse_order_id = resp.loyverse_order_id;
    if (resp.simulated) result.loyverse_simulated = true;

  } else if (Number(brandId) === 4) {
    const resp = await createSquareOrder(order);
    if (resp.success)          result.square_order_id   = resp.square_order_id;
    if (resp.square_payment_id) result.square_payment_id = resp.square_payment_id;
    if (resp.simulated)        result.square_simulated  = true;
  }

  return result;
}

// ════════════════════════════════════════
//  DISPATCHER — REVERSE ORDER
//  Handles ALL 3 reasons: cancel, refund, exchange
//  Loyverse → void receipt (DELETE)
//  Square   → refund via /v2/refunds (completed orders cannot be cancelled)
// ════════════════════════════════════════
async function reverseInExternalPOS(brandId, order, reason) {
  const result = {
    loyverse_voided:   false,
    square_reversed:   false,
    simulated:         false,
    reason,
  };

  console.log(`[POS Reverse] brand=${brandId} reason=${reason} order_id=${order.id}`);

  if (Number(brandId) === 3) {
    // Loyverse — void the receipt (same for cancel/refund/exchange)
    if (!order.loyverse_order_id) {
      console.log("[POS Reverse] No loyverse_order_id — skipping");
      return result;
    }
    const resp = await voidLoyverseReceipt(order.loyverse_order_id);
    result.loyverse_voided = resp.success;
    if (resp.simulated) result.simulated = true;
    console.log(`[POS Reverse] Loyverse void: ${resp.success ? "✅" : "❌"}`);

  } else if (Number(brandId) === 4) {
    // Square — reverse via /v2/refunds (works for cancel/refund/exchange because order is COMPLETED)
    if (!order.square_order_id) {
      console.log("[POS Reverse] No square_order_id — skipping");
      return result;
    }
    // Pass square_payment_id if stored in order (avoids extra API lookup)
    const resp = await reverseSquareOrder(
      order.square_order_id,
      order.total_price,
      order.square_payment_id || null
    );
    result.square_reversed = resp.success;
    if (resp.simulated) result.simulated = true;
    if (resp.refund_id) result.square_refund_id = resp.refund_id;
    console.log(`[POS Reverse] Square reverse: ${resp.success ? "✅" : "❌"} refund_id=${resp.refund_id || "n/a"}`);

  } else {
    console.log(`[POS Reverse] Brand ${brandId} has no POS integration`);
  }

  return result;
}

// Kept for backward compatibility (orderRoutes calls these by name)
const cancelInExternalPOS = (brandId, order) => reverseInExternalPOS(brandId, order, "cancel");
const refundInExternalPOS = (brandId, order) => reverseInExternalPOS(brandId, order, "refund");

module.exports = {
  saveToExternalPOS,
  reverseInExternalPOS,
  cancelInExternalPOS,
  refundInExternalPOS,
  createLoyverseReceipt,
  createSquareOrder,
  voidLoyverseReceipt,
  reverseSquareOrder,
};