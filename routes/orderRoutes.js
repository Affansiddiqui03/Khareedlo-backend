// Khareedlo Backend/routes/orderRoutes.js
// Handles self-reported orders + Loyverse/Square POS sync
// POST /api/orders         — submit order (all brands)
// GET  /api/orders/brand/:brandId — brand sees their orders
// GET  /api/orders/admin   — admin sees all orders
// PATCH /api/orders/:id/status — admin updates order status

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { saveToExternalPOS } = require("../services/posIntegrationService");

// ── POST /api/orders — Submit order after modal ───────────────
router.post("/", async (req, res) => {
  const {
    customer_id,
    brand_id,
    product_id,
    product_name,
    brand_name,
    quantity,
    unit_price,
  } = req.body;

  // Validation
  if (!brand_id || !product_id || !product_name || !quantity || !unit_price) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const qty        = parseInt(quantity) || 1;
  const unitPrice  = parseFloat(unit_price) || 0;
  const totalPrice = parseFloat((qty * unitPrice).toFixed(2));

  try {
    // 1. Save to external POS (Loyverse for Alkaram, Square for Limelight)
    const externalIds = await saveToExternalPOS(brand_id, {
      product_name,
      quantity:    qty,
      unit_price:  unitPrice,
      total_price: totalPrice,
      customer_id: customer_id || null,
    });

    // Determine source
    let source = "self_reported";
    if (externalIds.loyverse_order_id) source = "loyverse";
    if (externalIds.square_order_id)   source = "square";

    // 2. Save to platform_orders table
    const [result] = await db.promise().execute(
      `INSERT INTO platform_orders
         (customer_id, brand_id, product_id, product_name, brand_name,
          quantity, unit_price, total_price, source, loyverse_order_id, square_order_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id   || null,
        brand_id,
        product_id,
        product_name,
        brand_name    || "",
        qty,
        unitPrice,
        totalPrice,
        source,
        externalIds.loyverse_order_id || null,
        externalIds.square_order_id   || null,
      ]
    );

    res.json({
      success:          true,
      order_id:         result.insertId,
      total_price:      totalPrice,
      source,
      loyverse_order_id: externalIds.loyverse_order_id || null,
      square_order_id:   externalIds.square_order_id   || null,
      pos_simulated:     externalIds.loyverse_simulated || externalIds.square_simulated || false,
    });

  } catch (err) {
    console.error("Order submit error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ── GET /api/orders/brand/:brandId — Brand's orders ───────────
router.get("/brand/:brandId", async (req, res) => {
  try {
    const [rows] = await db.promise().execute(
      `SELECT
         po.*,
         c.name AS customer_name
       FROM platform_orders po
       LEFT JOIN customers c ON c.customer_id = po.customer_id
       WHERE po.brand_id = ?
       ORDER BY po.created_at DESC`,
      [req.params.brandId]
    );

    // Summary stats — cancelled/refunded/exchanged excluded from revenue
    const cancelledStatuses = ["cancelled", "refunded", "exchanged"];
    const activeOrders = rows.filter(r => !cancelledStatuses.includes(r.status));

    const totalOrders      = rows.length;
    const cancelledOrders  = rows.filter(r => cancelledStatuses.includes(r.status)).length;
    const totalRevenue     = activeOrders.reduce((s, r) => s + parseFloat(r.total_price || 0), 0);
    const loyverseOrders   = rows.filter(r => r.source === "loyverse").length;
    const squareOrders     = rows.filter(r => r.source === "square").length;
    const selfReported     = rows.filter(r => r.source === "self_reported").length;

    res.json({
      orders: rows,
      summary: {
        total_orders:     totalOrders,
        active_orders:    activeOrders.length,
        cancelled_orders: cancelledOrders,
        total_revenue:    parseFloat(totalRevenue.toFixed(2)),
        loyverse_orders:  loyverseOrders,
        square_orders:    squareOrders,
        self_reported:    selfReported,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/orders/admin — Admin sees all platform orders ────
router.get("/admin", async (req, res) => {
  try {
    const [rows] = await db.promise().execute(
      `SELECT po.*, c.name AS customer_name, b.brand_name AS brand
       FROM platform_orders po
       LEFT JOIN customers c ON c.customer_id = po.customer_id
       LEFT JOIN brands    b ON b.brand_id    = po.brand_id
       ORDER BY po.created_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/orders/:id/status ──────────────────────────────
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  const valid = ["reported", "confirmed", "delivered"];
  if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });

  try {
    await db.promise().execute(
      "UPDATE platform_orders SET status = ? WHERE id = ?",
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/orders/:id/cancel — Customer cancels/refunds/exchanges ──
// Customer can mark their own order as cancelled, refunded, or exchanged
// This updates Khareedlo DB and brand dashboard reflects it automatically
router.patch("/:id/cancel", async (req, res) => {
  const { reason, customer_id } = req.body;
  // reason: "cancelled" | "refunded" | "exchanged"
  const validReasons = ["cancelled", "refunded", "exchanged"];
  if (!validReasons.includes(reason)) {
    return res.status(400).json({ error: "Invalid reason. Must be: cancelled, refunded, or exchanged" });
  }

  try {
    // Verify this order belongs to this customer
    const [rows] = await db.promise().execute(
      "SELECT * FROM platform_orders WHERE id = ? AND customer_id = ?",
      [req.params.id, customer_id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Order not found or unauthorized" });
    }

    const order = rows[0];

    // Cannot cancel an already cancelled/refunded/exchanged order
    if (["cancelled", "refunded", "exchanged"].includes(order.status)) {
      return res.status(400).json({ error: "Order already " + order.status });
    }

    // Update status in DB
    await db.promise().execute(
      "UPDATE platform_orders SET status = ?, cancelled_at = NOW() WHERE id = ?",
      [reason, req.params.id]
    );

    res.json({
      success: true,
      order_id: req.params.id,
      new_status: reason,
      message: `Order marked as ${reason} successfully`,
    });

  } catch (err) {
    console.error("Order cancel error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/orders/customer/:customerId — Customer's orders ──
router.get("/customer/:customerId", async (req, res) => {
  try {
    const [rows] = await db.promise().execute(
      `SELECT * FROM platform_orders
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [req.params.customerId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;