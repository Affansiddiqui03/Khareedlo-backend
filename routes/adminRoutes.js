// backend/routes/adminRoutes.js  — REPLACE your existing adminRoutes.js

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const path    = require("path");
const fs      = require("fs");

// ══════════════════════════════════════════════════════
//  BRANDS
// ══════════════════════════════════════════════════════

// GET all APPROVED brands
router.get("/brands", (req, res) => {
  db.query(
    `SELECT brand_id, brand_name, email, city, contact, logo, banner, website, rating, status
     FROM brands WHERE status = 'APPROVED' ORDER BY brand_name ASC`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

// GET pending brand applications
router.get("/brands/pending", (req, res) => {
  db.query(
    `SELECT brand_id, brand_name, email, city, contact, logo, banner, website, status
     FROM brands WHERE status = 'PENDING' ORDER BY brand_id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

// GET all brands regardless of status (admin full list)
router.get("/brands/all", (req, res) => {
  db.query(
    `SELECT brand_id, brand_name, email, city, contact, logo, banner, website, rating, status
     FROM brands ORDER BY brand_id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

// PUT: Approve or Reject a brand
router.put("/brands/:id", (req, res) => {
  const { action } = req.body;
  const status = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : null;
  if (!status) return res.status(400).json({ message: "Invalid action. Use 'approve' or 'reject'." });

  db.query("UPDATE brands SET status = ? WHERE brand_id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true, message: `Brand ${status.toLowerCase()}`, brand_id: req.params.id, status });
  });
});

// DELETE: Remove brand + all its products + auth records (full cascade)
router.delete("/brands/:id", (req, res) => {
  const brandId = req.params.id;

  // Step 1: Get all product images so we can delete files from disk
  db.query("SELECT image FROM products WHERE brand_id = ?", [brandId], (err, products) => {
    if (err) return res.status(500).json({ message: "Failed to fetch brand products" });

    // Delete product image files from disk
    products.forEach(p => {
      if (p.image && p.image.startsWith("photos/")) {
        const fullPath = path.join(__dirname, "..", p.image);
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (_) {}
        }
      }
    });

    // Step 2: Delete POS activity for brand
    db.query("DELETE FROM pos_activity WHERE brand_id = ?", [brandId], (err2) => {
      if (err2) console.error("POS delete error (non-fatal):", err2);

      // Step 3: Delete all products
      db.query("DELETE FROM products WHERE brand_id = ?", [brandId], (err3) => {
        if (err3) return res.status(500).json({ message: "Failed to delete products" });

        // Step 4: Delete brand auth (brands_auth table)
        db.query("DELETE FROM brands_auth WHERE brand_id = ?", [brandId], (err4) => {
          if (err4) console.error("brands_auth delete error (non-fatal):", err4);

          // Step 5: Delete brand itself
          db.query("DELETE FROM brands WHERE brand_id = ?", [brandId], (err5) => {
            if (err5) return res.status(500).json({ message: "Failed to delete brand" });
            res.json({ success: true, message: "Brand and all associated data permanently deleted" });
          });
        });
      });
    });
  });
});


// ══════════════════════════════════════════════════════
//  PRODUCTS
// ══════════════════════════════════════════════════════

// GET all products with brand info (admin sees everything)
router.get("/products", (req, res) => {
  db.query(
    `SELECT p.*, b.brand_name, c.category_name, s.sub_category_name
     FROM products p
     JOIN brands b ON p.brand_id = b.brand_id
     LEFT JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
     ORDER BY p.product_id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

// GET only PENDING products
router.get("/products/pending", (req, res) => {
  db.query(
    `SELECT p.*, b.brand_name, c.category_name, s.sub_category_name
     FROM products p
     JOIN brands b ON p.brand_id = b.brand_id
     LEFT JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
     WHERE p.status = 'PENDING'
     ORDER BY p.product_id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

// GET all products sorted: PENDING first (for PendingProducts / AdminApprovals page)
router.get("/pending-products", (req, res) => {
  db.query(
    `SELECT p.*, b.brand_name, c.category_name, s.sub_category_name
     FROM products p
     JOIN brands b ON p.brand_id = b.brand_id
     LEFT JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN sub_categories s ON p.sub_category_id = s.sub_category_id
     ORDER BY
       CASE p.status WHEN 'PENDING' THEN 0 WHEN 'APPROVED' THEN 1 ELSE 2 END,
       p.product_id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

// PUT: Approve / Reject product — supports { action } or { status } body formats
router.put("/products/:id", (req, res) => {
  const { action, status: directStatus } = req.body;
  let status;
  if (directStatus && ["APPROVED","REJECTED","PENDING"].includes(directStatus)) {
    status = directStatus;
  } else if (action === "approve") {
    status = "APPROVED";
  } else if (action === "reject") {
    status = "REJECTED";
  } else {
    return res.status(400).json({ message: "Provide action (approve/reject) or status (APPROVED/REJECTED/PENDING)" });
  }

  db.query("UPDATE products SET status = ? WHERE product_id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true, product_id: req.params.id, status });
  });
});

// PUT: /products/:id/status — used by AdminApprovals.jsx
router.put("/products/:id/status", (req, res) => {
  const { status } = req.body;
  if (!["APPROVED","REJECTED","PENDING"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  db.query("UPDATE products SET status = ? WHERE product_id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true, product_id: req.params.id, status });
  });
});

// DELETE: Remove a product (admin)
router.delete("/products/:id", (req, res) => {
  // Delete image file first
  db.query("SELECT image FROM products WHERE product_id = ?", [req.params.id], (err, rows) => {
    if (!err && rows.length && rows[0].image && rows[0].image.startsWith("photos/")) {
      const fullPath = path.join(__dirname, "..", rows[0].image);
      if (fs.existsSync(fullPath)) try { fs.unlinkSync(fullPath); } catch (_) {}
    }
    db.query("DELETE FROM products WHERE product_id = ?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json({ success: true });
    });
  });
});


// ══════════════════════════════════════════════════════
//  CUSTOMERS / USERS
// ══════════════════════════════════════════════════════

router.get("/users", (req, res) => {
  db.query(
    `SELECT customer_id, name, email FROM customers ORDER BY name ASC`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});

// DELETE a customer
router.delete("/users/:id", (req, res) => {
  db.query("DELETE FROM customers WHERE customer_id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});


// ══════════════════════════════════════════════════════
//  STATS (admin dashboard overview cards)
// ══════════════════════════════════════════════════════

router.get("/stats", async (req, res) => {
  try {
    const run = (sql) => new Promise((resolve, reject) => {
      db.query(sql, (err, rows) => err ? reject(err) : resolve(rows[0]?.total ?? 0));
    });

    const [brands, users, liveProducts, pendingProducts, pendingBrands] = await Promise.all([
      run("SELECT COUNT(*) AS total FROM brands WHERE status = 'APPROVED'"),
      run("SELECT COUNT(*) AS total FROM customers"),
      run("SELECT COUNT(*) AS total FROM products WHERE status = 'APPROVED'"),
      run("SELECT COUNT(*) AS total FROM products WHERE status = 'PENDING'"),
      run("SELECT COUNT(*) AS total FROM brands WHERE status = 'PENDING'"),
    ]);

    res.json({ brands, users, live_products: liveProducts, pending_products: pendingProducts, pending_brands: pendingBrands });
  } catch (err) {
    res.status(500).json({ message: "Stats error" });
  }
});



// ══════════════════════════════════════════════════════
//  ONE-TIME: Clean up local "photos/" image paths → set NULL
//  POST /api/admin/cleanup-local-images
//  Call this once from admin panel or Postman
// ══════════════════════════════════════════════════════
router.post("/cleanup-local-images", (req, res) => {
  const queries = [
    "UPDATE products SET image = NULL WHERE image IS NOT NULL AND image NOT LIKE 'http%'",
    "UPDATE brands   SET logo  = NULL WHERE logo  IS NOT NULL AND logo  NOT LIKE 'http%'",
    "UPDATE brands   SET banner= NULL WHERE banner IS NOT NULL AND banner NOT LIKE 'http%'",
  ];

  let done = 0;
  let totalAffected = 0;
  const errors = [];

  queries.forEach(sql => {
    db.query(sql, (err, result) => {
      done++;
      if (err) errors.push(err.message);
      else totalAffected += result.affectedRows;

      if (done === queries.length) {
        if (errors.length) return res.status(500).json({ errors });
        res.json({
          success: true,
          message: `Cleaned up ${totalAffected} local image paths. They will show as "No Image" until re-uploaded via Cloudinary.`
        });
      }
    });
  });
});

module.exports = router;