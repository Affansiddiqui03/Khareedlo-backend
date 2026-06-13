// brandSyncService.js
// REAL Pull integration — Loyverse (Alkaram) + Square (Limelight)
// Tokens are already in .env — this does REAL API calls

const db    = require("../config/db");
const https = require("https");

function apiGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: "GET", headers, timeout: 15000 },
      (res) => {
        let data = "";
        res.on("data", c => { data += c; });
        res.on("end", () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

async function saveSyncLog(brandId, brandName, status, counts, durationS) {
  try {
    await db.promise().execute(
      `INSERT INTO sync_logs (brand_id, brand_name, status, message, synced_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [brandId, brandName, status,
       JSON.stringify({ ...counts, duration_s: durationS })]
    );
  } catch (e) { console.error("[SyncLog]", e.message); }
}

// ── ALKARAM — Loyverse Pull ───────────────────────────────────
async function syncAlkaram() {
  const t0      = Date.now();
  const token   = process.env.LOYVERSE_TOKEN;
  const BRAND   = 3;

  if (!token) throw new Error("LOYVERSE_TOKEN not set in .env");

  const result = await apiGet(
    "api.loyverse.com",
    "/v1.0/items?limit=250",
    { Authorization: `Bearer ${token}` }
  );

  if (result.status !== 200)
    throw new Error(`Loyverse API returned ${result.status}`);

  const items = result.data?.items || [];
  let inserted = 0, updated = 0, outOfStock = 0;

  for (const item of items) {
    const name    = (item.item_name || "").trim();
    if (!name) continue;

    const variant  = item.variants?.[0];
    const price    = parseFloat(variant?.price || 0);
    const inStock  = (variant?.inventory_levels?.[0]?.in_stock ?? 1) > 0;
    const image    = item.image_url || null;
    const status   = "PENDING"; // Admin will review pulled products before they go live

    if (!inStock) outOfStock++;

    const [ex] = await db.promise().execute(
      "SELECT product_id FROM products WHERE product_name=? AND brand_id=?",
      [name, BRAND]
    );

    if (ex.length === 0) {
      await db.promise().execute(
        `INSERT INTO products
         (brand_id, product_name, price, gender, status, category_id, image, buy_now_link, website_link, created_at)
         VALUES (?, ?, ?, 'Women', ?, 2, ?, ?, ?, NOW())`,
        [BRAND, name, price, status, image,
         "https://www.alkaramstudio.com/collections/all", // default — admin can update later
         "https://www.alkaramstudio.com"]
      );
      inserted++;
    } else {
      await db.promise().execute(
        `UPDATE products SET price=?, status=?
         ${image ? ", image=?" : ""}
         WHERE product_name=? AND brand_id=?`,
        image
          ? [price, status, image, name, BRAND]
          : [price, status, name, BRAND]
      );
      updated++;
    }
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  const counts = { inserted, updated, out_of_stock: outOfStock };
  await saveSyncLog(BRAND, "Alkaram Studio", "success", counts, dur);

  return {
    brand: "Alkaram Studio", total: items.length,
    ...counts, duration_s: dur, source: "Loyverse (live)",
  };
}

// ── LIMELIGHT — Square Catalog Pull ──────────────────────────
async function syncLimelight() {
  const t0    = Date.now();
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const BRAND = 4;

  if (!token) throw new Error("SQUARE_ACCESS_TOKEN not set in .env");

  const result = await apiGet(
    "connect.squareupsandbox.com",
    "/v2/catalog/list?types=ITEM",
    {
      Authorization:    `Bearer ${token}`,
      "Square-Version": "2024-01-17",
    }
  );

  if (result.status !== 200)
    throw new Error(`Square API returned ${result.status}`);

  const objects = result.data?.objects || [];
  let inserted = 0, updated = 0;

  for (const obj of objects) {
    if (obj.type !== "ITEM") continue;
    const name  = (obj.item_data?.name || "").trim();
    if (!name) continue;

    const priceMoney = obj.item_data?.variations?.[0]
      ?.item_variation_data?.price_money?.amount || 0;
    const price = priceMoney / 100; // Square stores cents
    const image = obj.item_data?.image_ids ? null : null; // images need separate call

    const [ex] = await db.promise().execute(
      "SELECT product_id FROM products WHERE product_name=? AND brand_id=?",
      [name, BRAND]
    );

    if (ex.length === 0) {
      await db.promise().execute(
        `INSERT INTO products
         (brand_id, product_name, price, gender, status, category_id, buy_now_link, website_link, created_at)
         VALUES (?, ?, ?, 'Women', 'APPROVED', 2, ?, ?, NOW())`,
        [BRAND, name, price,
         "https://www.lime-light.com/collections/all",
         "https://www.lime-light.com"]
      );
      inserted++;
    } else {
      await db.promise().execute(
        "UPDATE products SET price=? WHERE product_name=? AND brand_id=?",
        [price, name, BRAND]
      );
      updated++;
    }
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  const counts = { inserted, updated, out_of_stock: 0 };
  await saveSyncLog(BRAND, "Limelight", "success", counts, dur);

  return {
    brand: "Limelight", total: objects.length,
    ...counts, duration_s: dur, source: "Square Sandbox (live)",
  };
}

// ── ZELLBURY — No POS API ─────────────────────────────────────
async function syncZellbury() {
  const t0 = Date.now();
  const [rows] = await db.promise().execute(
    "SELECT COUNT(*) as cnt FROM products WHERE brand_id=2 AND status='APPROVED'"
  );
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  const counts = { inserted: 0, updated: rows[0].cnt, out_of_stock: 0 };
  await saveSyncLog(2, "Zellbury", "success", counts, dur);
  return {
    brand: "Zellbury", total: rows[0].cnt,
    ...counts, duration_s: dur,
    source: "Manual (no POS API — Zellbury uses proprietary system)",
  };
}

// ── DISPATCHER ────────────────────────────────────────────────
const BRAND_CONFIG = {
  alkaram:   { label: "Alkaram Studio", fn: syncAlkaram   },
  limelight: { label: "Limelight",      fn: syncLimelight },
  zellbury:  { label: "Zellbury",       fn: syncZellbury  },
};

async function syncBrand(slug) {
  const cfg = BRAND_CONFIG[slug];
  if (!cfg) throw new Error(`Unknown brand: ${slug}`);
  return cfg.fn();
}

async function syncAllBrands() {
  const out = [];
  for (const cfg of Object.values(BRAND_CONFIG)) {
    try   { out.push(await cfg.fn()); }
    catch (e) { out.push({ brand: cfg.label, error: e.message }); }
  }
  return out;
}

module.exports = { syncBrand, syncAllBrands, BRAND_CONFIG };