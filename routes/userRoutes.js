// Khareedlo Backend/routes/userRoutes.js
// FIXED: CONVERT_TZ applied to all weekly chart queries (PKT = UTC+5)
// So Friday activity shows on Friday, not Thursday (UTC offset)

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// ── Helper: fill all 7 days in PKT time ──────────────────────
function toPKTDateStr(date) {
  const pkt = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const y = pkt.getUTCFullYear();
  const m = String(pkt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pkt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPKTDayName(date) {
  const pkt = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][pkt.getUTCDay()];
}

function buildLast7Days(rows, key = "cnt") {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d      = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const pktStr = toPKTDateStr(d);
    const day    = getPKTDayName(d);

    const found = rows.find(r => {
      const raw = r.dt;
      if (!raw) return false;
      const s = typeof raw.toISOString === "function" ? raw.toISOString() : String(raw);
      return s.slice(0, 10) === pktStr;
    });

    result.push({ day, value: found ? Number(found[key] || 0) : 0 });
  }
  return result;
}

// ── GET /api/user/dashboard ───────────────────────────────────
// 3-series chart: brands visited, product clicks, buy redirects
router.get("/dashboard", async (req, res) => {
  const cid = req.query.customer_id;
  if (!cid) return res.status(400).json({ error: "customer_id required" });

  const run = (sql, params) =>
    new Promise((resolve, reject) =>
      db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
    );

  try {
    const [
      brandVisits,
      productClicks,
      buyRedirects,
      recentProducts,
      weeklyBrands,
      weeklyClicks,
      weeklyBuys,
    ] = await Promise.all([
      run("SELECT COUNT(*) AS total FROM user_brand_visits WHERE customer_id = ?",  [cid]),
      run("SELECT COUNT(*) AS total FROM user_product_clicks WHERE customer_id = ?", [cid]),
      run("SELECT COUNT(*) AS total FROM user_buy_redirects WHERE customer_id = ?",  [cid]),

      run(`SELECT product_id, product_name, brand_name, brand_id, image, price, MAX(clicked_at) AS last_click
           FROM user_product_clicks WHERE customer_id = ?
           GROUP BY product_id, product_name, brand_name, brand_id, image, price
           ORDER BY last_click DESC LIMIT 15`, [cid]),

      // Weekly brand visits — PKT timezone
      run(`SELECT DATE(CONVERT_TZ(visited_at, '+00:00', '+05:00')) AS dt, COUNT(*) AS cnt
           FROM user_brand_visits
           WHERE customer_id = ?
             AND CONVERT_TZ(visited_at, '+00:00', '+05:00') >= DATE_SUB(CONVERT_TZ(NOW(),'+00:00','+05:00'), INTERVAL 6 DAY)
           GROUP BY DATE(CONVERT_TZ(visited_at, '+00:00', '+05:00'))`, [cid]),

      // Weekly product clicks — PKT timezone
      run(`SELECT DATE(CONVERT_TZ(clicked_at, '+00:00', '+05:00')) AS dt, COUNT(*) AS cnt
           FROM user_product_clicks
           WHERE customer_id = ?
             AND CONVERT_TZ(clicked_at, '+00:00', '+05:00') >= DATE_SUB(CONVERT_TZ(NOW(),'+00:00','+05:00'), INTERVAL 6 DAY)
           GROUP BY DATE(CONVERT_TZ(clicked_at, '+00:00', '+05:00'))`, [cid]),

      // Weekly buy redirects — PKT timezone
      run(`SELECT DATE(CONVERT_TZ(redirected_at, '+00:00', '+05:00')) AS dt, COUNT(*) AS cnt
           FROM user_buy_redirects
           WHERE customer_id = ?
             AND CONVERT_TZ(redirected_at, '+00:00', '+05:00') >= DATE_SUB(CONVERT_TZ(NOW(),'+00:00','+05:00'), INTERVAL 6 DAY)
           GROUP BY DATE(CONVERT_TZ(redirected_at, '+00:00', '+05:00'))`, [cid]),
    ]);

    // Build 7-day arrays
    const brandsWeek  = buildLast7Days(weeklyBrands);
    const clicksWeek  = buildLast7Days(weeklyClicks);
    const buysWeek    = buildLast7Days(weeklyBuys);

    // Merge into single chart array: { day, brandVisits, productClicks, buyRedirects }
    const weeklyChart = brandsWeek.map((item, i) => ({
      day:          item.day,
      "Brand Visits":    item.value,
      "Product Clicks":  clicksWeek[i]?.value  || 0,
      "Buy Redirects":   buysWeek[i]?.value    || 0,
    }));

    res.json({
      stats: {
        brandVisits:   brandVisits[0]?.total  || 0,
        productClicks: productClicks[0]?.total || 0,
        buyRedirects:  buyRedirects[0]?.total  || 0,
      },
      recentProducts: recentProducts || [],
      weeklyChart,
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/user/track/brand-visit ─────────────────────────
router.post("/track/brand-visit", (req, res) => {
  const { customer_id, brand_id, brand_name } = req.body;
  if (!customer_id || !brand_id) return res.status(400).json({ error: "customer_id and brand_id required" });

  db.query(
    "INSERT INTO user_brand_visits (customer_id, brand_id, brand_name) VALUES (?, ?, ?)",
    [customer_id, brand_id, brand_name || ""],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true });
    }
  );
});

// ── POST /api/user/track/product-click ───────────────────────
router.post("/track/product-click", (req, res) => {
  const { customer_id, product_id, product_name, brand_name, brand_id, image, price } = req.body;
  if (!customer_id || !product_id) return res.status(400).json({ error: "customer_id and product_id required" });

  db.query(
    `INSERT INTO user_product_clicks
       (customer_id, product_id, product_name, brand_name, brand_id, image, price)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, product_id, product_name || "", brand_name || "", brand_id || null, image || null, price || null],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true });
    }
  );
});

// ── POST /api/user/track/buy-redirect ────────────────────────
router.post("/track/buy-redirect", (req, res) => {
  const { customer_id, product_id, product_name, brand_name } = req.body;
  if (!customer_id || !product_id) return res.status(400).json({ error: "customer_id and product_id required" });

  db.query(
    `INSERT INTO user_buy_redirects (customer_id, product_id, product_name, brand_name)
     VALUES (?, ?, ?, ?)`,
    [customer_id, product_id, product_name || "", brand_name || ""],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true });
    }
  );
});

// ── GET /api/user/messages — contact messages for user ───────
router.get("/messages/:customerId", (req, res) => {
  db.query(
    `SELECT id, name, email, topic, brand_name, message, is_read,
            replied, reply_text, replied_at, created_at
     FROM contact_messages WHERE customer_id = ?
     ORDER BY created_at DESC`,
    [req.params.customerId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

// ── POST /api/user/feedback ───────────────────────────────────
router.post("/feedback", (req, res) => {
  const { customer_id, name, email, message } = req.body;
  db.query(
    "INSERT INTO feedback (customer_id, name, email, message) VALUES (?, ?, ?, ?)",
    [customer_id || null, name, email, message],
    (err) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true });
    }
  );
});

// ── PUT /api/user/change-password ────────────────────────────
router.put("/change-password", (req, res) => {
  const { customer_id, current_password, new_password } = req.body;

  db.query(
    "SELECT password FROM customers WHERE customer_id = ?",
    [customer_id],
    (err, rows) => {
      if (err || !rows.length) return res.status(404).json({ error: "User not found" });

      if (rows[0].password !== current_password) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      db.query(
        "UPDATE customers SET password = ? WHERE customer_id = ?",
        [new_password, customer_id],
        (err2) => {
          if (err2) return res.status(500).json({ error: "Failed to update password" });
          res.json({ success: true });
        }
      );
    }
  );
});

module.exports = router;