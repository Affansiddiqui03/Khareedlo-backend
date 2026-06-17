// Khareedlo Backend/routes/orderRoutes.js
// POST   /api/orders                    — confirm order (save + POS sync)
// GET    /api/orders/brand/:brandId     — brand dashboard orders
// GET    /api/orders/admin              — admin all orders
// GET    /api/orders/customer/:id       — user's own orders
// PATCH  /api/orders/:id/status         — admin status update
// PATCH  /api/orders/:id/cancel         — user: cancel / refund / exchange
// POST   /api/orders/:id/exchange-item  — user: confirm exchange product

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const {
  saveToExternalPOS,
  createLoyverseReceipt,
  createSquareOrder,
  voidLoyverseReceipt,
  voidSquareOrder,
} = require("../services/posIntegrationService");

// ── POST /api/orders — Confirm order after BuyNow modal ──────────────
router.post("/", async (req, res) => {
  const { customer_id, brand_id, product_id, product_name, brand_name, quantity, unit_price } = req.body;

  if (!brand_id || !product_id || !product_name || !quantity || !unit_price)
    return res.status(400).json({ error: "Missing required fields" });

  const qty        = parseInt(quantity) || 1;
  const unitPrice  = parseFloat(unit_price) || 0;
  const totalPrice = parseFloat((qty * unitPrice).toFixed(2));

  try {
    const externalIds = await saveToExternalPOS(brand_id, {
      product_name, quantity: qty, unit_price: unitPrice,
      total_price: totalPrice, customer_id: customer_id || null,
    });

    let source = "self_reported";
    if (externalIds.loyverse_order_id) source = "loyverse";
    if (externalIds.square_order_id)   source = "square";

    const [result] = await db.promise().execute(
      `INSERT INTO platform_orders
         (customer_id, brand_id, product_id, product_name, brand_name,
          quantity, unit_price, total_price, source, loyverse_order_id, square_order_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id || null, brand_id, product_id, product_name, brand_name || "",
        qty, unitPrice, totalPrice, source,
        externalIds.loyverse_order_id || null,
        externalIds.square_order_id   || null,
      ]
    );

    res.json({
      success: true, order_id: result.insertId, total_price: totalPrice, source,
      loyverse_order_id: externalIds.loyverse_order_id || null,
      square_order_id:   externalIds.square_order_id   || null,
      pos_simulated:     externalIds.loyverse_simulated || externalIds.square_simulated || false,
    });

  } catch (err) {
    console.error("Order submit error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// ── GET /api/orders/brand/:brandId — Brand dashboard ─────────────────
router.get("/brand/:brandId", async (req, res) => {
  try {
    const [rows] = await db.promise().execute(
      `SELECT po.*, c.name AS customer_name
       FROM platform_orders po
       LEFT JOIN customers c ON c.customer_id = po.customer_id
       WHERE po.brand_id = ?
       ORDER BY po.created_at DESC`,
      [req.params.brandId]
    );

    const CLOSED = ["cancelled", "refunded", "exchanged"];
    const activeOrders   = rows.filter(r => !CLOSED.includes(r.status));
    const cancelledRows  = rows.filter(r => r.status === "cancelled");
    const refundedRows   = rows.filter(r => r.status === "refunded");
    const exchangedRows  = rows.filter(r => r.status === "exchanged");

    const totalRevenue   = activeOrders.reduce((s, r) => s + parseFloat(r.total_price || 0), 0);
    const refundedAmount = refundedRows.reduce((s, r)  => s + parseFloat(r.total_price || 0), 0);

    res.json({
      orders: rows,
      summary: {
        total_orders:     rows.length,
        active_orders:    activeOrders.length,
        cancelled_orders: cancelledRows.length,
        refunded_orders:  refundedRows.length,
        exchanged_orders: exchangedRows.length,
        total_revenue:    parseFloat(totalRevenue.toFixed(2)),
        refunded_amount:  parseFloat(refundedAmount.toFixed(2)),
        loyverse_orders:  rows.filter(r => r.source === "loyverse").length,
        square_orders:    rows.filter(r => r.source === "square").length,
        self_reported:    rows.filter(r => r.source === "self_reported").length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/orders/admin — Admin all orders ──────────────────────────
router.get("/admin", async (req, res) => {
  try {
    const [rows] = await db.promise().execute(
      `SELECT po.*, c.name AS customer_name, b.brand_name AS brand
       FROM platform_orders po
       LEFT JOIN customers c ON c.customer_id = po.customer_id
       LEFT JOIN brands    b ON b.brand_id    = po.brand_id
       ORDER BY po.created_at DESC LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/orders/:id/status — Admin status update ───────────────
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

// ── GET /api/orders/customer/:customerId — User's own orders ──────────
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

// ── PATCH /api/orders/:id/cancel — User: Cancel / Refund / Exchange ──
// This is the main action endpoint.
// Cancel  → status = cancelled, POS void
// Refund  → status = refunded,  POS void, refunded_amount recorded
// Exchange → status = exchanged, POS void on old order
//            (new product confirmation comes via separate POST /api/orders)
router.patch("/:id/cancel", async (req, res) => {
  const { reason, customer_id } = req.body;
  const validReasons = ["cancelled", "refunded", "exchanged"];

  if (!validReasons.includes(reason))
    return res.status(400).json({ error: "reason must be: cancelled | refunded | exchanged" });

  try {
    // 1. Fetch the order — verify ownership
    const [rows] = await db.promise().execute(
      "SELECT * FROM platform_orders WHERE id = ? AND customer_id = ?",
      [req.params.id, customer_id]
    );

    if (!rows.length)
      return res.status(404).json({ error: "Order not found or unauthorized" });

    const order = rows[0];

    if (["cancelled", "refunded", "exchanged"].includes(order.status))
      return res.status(400).json({ error: `Order already ${order.status}` });

    // 2. Void on POS (Loyverse for Alkaram, Square for Limelight)
    let posVoided = false;
    try {
      if (order.source === "loyverse" && order.loyverse_order_id) {
        await voidLoyverseReceipt(order.loyverse_order_id);
        posVoided = true;
        console.log(`[Loyverse] Voided receipt ${order.loyverse_order_id}`);
      } else if (order.source === "square" && order.square_order_id) {
        await voidSquareOrder(order.square_order_id);
        posVoided = true;
        console.log(`[Square] Voided order ${order.square_order_id}`);
      }
    } catch (posErr) {
      // POS void failed — log but don't block the Khareedlo update
      console.warn(`[POS] Void failed for order ${req.params.id}:`, posErr.message);
    }

    // 3. Update Khareedlo DB
    const refundedAmount = reason === "refunded" ? parseFloat(order.total_price) : null;

    await db.promise().execute(
      `UPDATE platform_orders
       SET status = ?, cancelled_at = NOW(), refunded_amount = ?
       WHERE id = ?`,
      [reason, refundedAmount, req.params.id]
    );

    res.json({
      success:        true,
      order_id:       req.params.id,
      new_status:     reason,
      pos_voided:     posVoided,
      refunded_amount: refundedAmount,
      message:        `Order marked as ${reason}${posVoided ? " and removed from POS" : ""}`,
    });

  } catch (err) {
    console.error("Order cancel error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;