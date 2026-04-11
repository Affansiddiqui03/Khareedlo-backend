const express = require("express");
const router = express.Router();
const db = require("../config/db");

// LOGIN (ADMIN / BRAND / CUSTOMER)
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  // 1️⃣ ADMIN
  db.query(
    "SELECT admin_id FROM admins WHERE email=? AND password=?",
    [email, password],
    (err, admin) => {
      if (err) return res.status(500).json({ message: "DB error" });

      if (admin.length) {
        return res.json({
          user: {
            id: admin[0].admin_id,
            email,
            role: "admin",
          },
        });
      }

      // 2️⃣ BRAND
      db.query(
        "SELECT brand_id, brand_name, email, status FROM brands WHERE email=? AND password=?",
        [email, password],
        (err, brand) => {
          if (brand?.length) {
            if (brand[0].status !== "APPROVED") {
              return res.status(403).json({ message: "Brand not approved yet" });
            }

            return res.json({
              user: {
                id: brand[0].brand_id,
                name: brand[0].brand_name,
                email: brand[0].email,
                role: "brand",
              },
            });
          }

          // 3️⃣ CUSTOMER
          db.query(
            "SELECT customer_id, name, email FROM customers WHERE email=? AND password=?",
            [email, password],
            (err, cust) => {
              if (!cust?.length) {
                return res.status(401).json({ message: "Invalid credentials | or Register First" });
              }

              return res.json({
                user: {
                  id: cust[0].customer_id,
                  name: cust[0].name,
                  email: cust[0].email,
                  role: "customer",
                },
              });
            }
          );
        }
      );
    }
  );
});

// CUSTOMER REGISTER
router.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  db.query(
    "INSERT INTO customers (name,email,password) VALUES (?,?,?)",
    [name, email, password],
    (err) => {
      if (err)
        return res.status(400).json({ message: "Email already exists" });
      res.json({ message: "Customer registered" });
    }
  );
});

module.exports = router;
