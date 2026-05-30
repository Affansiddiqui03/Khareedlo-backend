// Khareedlo Backend/routes/syncRoutes.js
// Admin endpoints to trigger product sync + view sync history
// No JWT (same pattern as other admin routes in this project)

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { syncBrand, syncAllBrands, BRAND_CONFIG } = require("../services/brandSyncService");

// Track if a sync is already running (prevent double-trigger)
let syncInProgress = false;

// ── POST /api/sync/all — sync all brands ──────────────────────
router.post("/all", async (req, res) => {
  if (syncInProgress) {
    return res.status(409).json({ error: "Sync already in progress. Please wait." });
  }
  syncInProgress = true;

  try {
    const results = await syncAllBrands();
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    syncInProgress = false;
  }
});

// ── POST /api/sync/:brand — sync one brand ────────────────────
router.post("/:brand", async (req, res) => {
  const { brand } = req.params;

  if (!BRAND_CONFIG[brand]) {
    return res.status(404).json({
      error: `Brand "${brand}" not found. Valid: ${Object.keys(BRAND_CONFIG).join(", ")}`,
    });
  }

  if (syncInProgress) {
    return res.status(409).json({ error: "Sync already running." });
  }

  syncInProgress = true;
  try {
    const result = await syncBrand(brand);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    syncInProgress = false;
  }
});

// ── GET /api/sync/status — is a sync running? ─────────────────
router.get("/status", (req, res) => {
  res.json({ inProgress: syncInProgress });
});

// ── GET /api/sync/logs — sync history ─────────────────────────
router.get("/logs", async (req, res) => {
  try {
    const [rows] = await db.promise().execute(`
      SELECT sl.*, b.brand_name
      FROM sync_logs sl
      LEFT JOIN brands b ON b.brand_id = sl.brand_id
      ORDER BY sl.synced_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch {
    res.json([]);
  }
});

module.exports = router;