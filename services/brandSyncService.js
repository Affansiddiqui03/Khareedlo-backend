// Khareedlo Backend/services/brandSyncService.js
// Stub — sync feature not yet implemented.
// syncRoutes.js requires these exports so the server doesn't crash on startup.

const BRAND_CONFIG = {};

async function syncBrand(brandSlug) {
  return { brand: brandSlug, synced: 0, message: "Sync not configured for this brand" };
}

async function syncAllBrands() {
  return Object.keys(BRAND_CONFIG).map(b => ({ brand: b, synced: 0 }));
}

module.exports = { syncBrand, syncAllBrands, BRAND_CONFIG };
