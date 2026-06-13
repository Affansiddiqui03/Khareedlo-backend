// Khareedlo Backend/services/brandSyncService.js
// Real POS Pull Sync — Loyverse (Alkaram brand_id=3) + Square (Limelight brand_id=4)
// FIX 1: Price fallback for "Variable" items — uses first variant price
// FIX 2: Duplicate prevention — checks by (brand_id + product_name) before INSERT
// FIX 3: Only NEW items from POS are pulled — order confirmations (PUSH) don't re-sync

const db     = require("../config/db");
const https  = require("https");

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
      timeout: 20000,
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

// ── Price helper: handles Variable pricing ───────────────────
function resolvePrice(item) {
  if (!item) return 0;

  // Direct price on item (some Loyverse items)
  if (item.price && Number(item.price) > 0) return Number(item.price);

  // Loyverse: variants array
  if (Array.isArray(item.variants) && item.variants.length > 0) {
    for (const v of item.variants) {
      const p = Number(v.price || v.default_price || 0);
      if (p > 0) return p;
    }
  }

  // Square: item_data.variations
  if (item.item_data?.variations) {
    for (const v of item.item_data.variations) {
      const amt = v.item_variation_data?.price_money?.amount;
      if (amt && amt > 0) {
        // Square stores amounts in smallest unit (pence/cents) — PKR is no-decimal
        return Math.round(amt / 100);
      }
    }
  }

  return 0;
}

// ── Check if product already exists (prevent duplicate pull) ─
async function productExists(brandId, productName) {
  const [rows] = await db.promise().execute(
    "SELECT product_id FROM products WHERE brand_id = ? AND product_name = ? LIMIT 1",
    [brandId, productName.trim()]
  );
  return rows.length > 0;
}

// ════════════════════════════════════════════════════════════
//  LOYVERSE — Alkaram (brand_id = 3)
// ════════════════════════════════════════════════════════════
async function syncAlkaram() {
  const token   = process.env.LOYVERSE_TOKEN;
  const brandId = 3;

  if (!token || token === "your_loyverse_token") {
    console.warn("[Sync/Alkaram] LOYVERSE_TOKEN not set");
    return { brand: "Alkaram", inserted: 0, skipped: 0, error: "LOYVERSE_TOKEN not configured in Railway env" };
  }

  console.log("[Sync/Alkaram] Fetching items from Loyverse...");

  const result = await apiRequest(
    "api.loyverse.com",
    "/v1.0/items?limit=250",
    "GET",
    { "Authorization": `Bearer ${token}` },
    null
  );

  if (result.status !== 200) {
    throw new Error(`Loyverse API error: ${result.status} — ${JSON.stringify(result.data)}`);
  }

  const items    = result.data?.items || [];
  let inserted   = 0;
  let skipped    = 0;

  console.log(`[Sync/Alkaram] Got ${items.length} items from Loyverse`);

  for (const item of items) {
    const name  = (item.item_name || "").trim();
    if (!name) { skipped++; continue; }

    const price = resolvePrice(item);
    const image = item.image_url || null;

    // Skip if already in DB (prevents re-pulling products that were already synced or order-confirmed)
    const exists = await productExists(brandId, name);
    if (exists) {
      console.log(`[Sync/Alkaram] Skip existing: "${name}"`);
      skipped++;
      continue;
    }

    // Insert as PENDING — brand will edit image/category, admin will approve
    await db.promise().execute(
      `INSERT INTO products
         (brand_id, product_name, price, gender, status, category_id, sub_category_id, image, buy_now_link, website_link)
       VALUES (?, ?, ?, 'Women', 'PENDING', 2, 5, ?, '', '')`,
      [brandId, name, price, image]
    );

    console.log(`[Sync/Alkaram] Inserted: "${name}" @ PKR ${price}`);
    inserted++;
  }

  return { brand: "Alkaram", inserted, skipped, total: items.length };
}

// ════════════════════════════════════════════════════════════
//  SQUARE — Limelight (brand_id = 4)
// ════════════════════════════════════════════════════════════
async function syncLimelight() {
  const token    = process.env.SQUARE_ACCESS_TOKEN;
  const brandId  = 4;

  if (!token || token === "your_square_token") {
    console.warn("[Sync/Limelight] SQUARE_ACCESS_TOKEN not set");
    return { brand: "Limelight", inserted: 0, skipped: 0, error: "SQUARE_ACCESS_TOKEN not configured in Railway env" };
  }

  console.log("[Sync/Limelight] Fetching catalog from Square...");

  // Square sandbox
  const hostname = token.startsWith("EAAAE") ? "connect.squareupsandbox.com" : "connect.squareup.com";

  const result = await apiRequest(
    hostname,
    "/v2/catalog/list?types=ITEM",
    "GET",
    {
      "Authorization":  `Bearer ${token}`,
      "Square-Version": "2024-01-17",
    },
    null
  );

  if (result.status !== 200) {
    throw new Error(`Square API error: ${result.status} — ${JSON.stringify(result.data)}`);
  }

  const objects  = result.data?.objects || [];
  let inserted   = 0;
  let skipped    = 0;

  console.log(`[Sync/Limelight] Got ${objects.length} objects from Square`);

  for (const obj of objects) {
    if (obj.type !== "ITEM") { skipped++; continue; }

    const name  = (obj.item_data?.name || "").trim();
    if (!name) { skipped++; continue; }

    const price = resolvePrice(obj);
    const image = obj.item_data?.image_ids?.[0] ? null : null; // Square images need separate call, skip for now

    const exists = await productExists(brandId, name);
    if (exists) {
      console.log(`[Sync/Limelight] Skip existing: "${name}"`);
      skipped++;
      continue;
    }

    await db.promise().execute(
      `INSERT INTO products
         (brand_id, product_name, price, gender, status, category_id, sub_category_id, image, buy_now_link, website_link)
       VALUES (?, ?, ?, 'Women', 'PENDING', 2, 5, ?, '', '')`,
      [brandId, name, price, image]
    );

    console.log(`[Sync/Limelight] Inserted: "${name}" @ PKR ${price}`);
    inserted++;
  }

  return { brand: "Limelight", inserted, skipped, total: objects.length };
}

// ════════════════════════════════════════════════════════════
//  BRAND CONFIG (used by syncRoutes.js for validation)
// ════════════════════════════════════════════════════════════
const BRAND_CONFIG = {
  alkaram:   { brand_id: 3, label: "Alkaram Studio" },
  limelight: { brand_id: 4, label: "Limelight"      },
};

async function syncBrand(brandSlug) {
  const t0 = Date.now();
  let result;

  if (brandSlug === "alkaram")   result = await syncAlkaram();
  else if (brandSlug === "limelight") result = await syncLimelight();
  else return { brand: brandSlug, inserted: 0, error: "Unknown brand slug" };

  result.duration_s  = ((Date.now() - t0) / 1000).toFixed(1);
  result.synced_at   = new Date().toISOString();

  // Log to sync_logs if table exists (non-fatal if not)
  try {
    const brandId = BRAND_CONFIG[brandSlug]?.brand_id;
    if (brandId) {
      await db.promise().execute(
        `INSERT INTO sync_logs (brand_id, inserted, skipped, duration_s, synced_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE inserted=VALUES(inserted), skipped=VALUES(skipped), duration_s=VALUES(duration_s), synced_at=NOW()`,
        [brandId, result.inserted || 0, result.skipped || 0, parseFloat(result.duration_s)]
      ).catch(() => {
        // sync_logs table may not have ON DUPLICATE — try plain INSERT
        return db.promise().execute(
          `INSERT INTO sync_logs (brand_id, inserted, skipped, duration_s, synced_at) VALUES (?, ?, ?, ?, NOW())`,
          [brandId, result.inserted || 0, result.skipped || 0, parseFloat(result.duration_s)]
        ).catch(() => {}); // table might not exist — non-fatal
      });
    }
  } catch (e) {
    console.warn("[SyncLog] Could not write to sync_logs:", e.message);
  }

  return result;
}

async function syncAllBrands() {
  const results = [];
  for (const slug of Object.keys(BRAND_CONFIG)) {
    try {
      results.push(await syncBrand(slug));
    } catch (err) {
      results.push({ brand: slug, inserted: 0, error: err.message });
    }
  }
  return results;
}

module.exports = { syncBrand, syncAllBrands, BRAND_CONFIG };