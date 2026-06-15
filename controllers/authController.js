const db     = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");

const ADMIN_EMAIL = "khareedlo@gmail.com";

// ── REGISTER ──────────────────────────────────────────────────
exports.register = (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (normalizedEmail === ADMIN_EMAIL) {
    return res.status(400).json({ message: "This email address is not available for registration." });
  }

  db.query("SELECT user_id FROM users WHERE LOWER(email)=?", [normalizedEmail], (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error. Please try again." });

    if (rows.length) {
      return res.status(400).json({ message: "This email is already registered. Please login." });
    }

    bcrypt.hash(password, 12, (hashErr, hashed) => {
      if (hashErr) return res.status(500).json({ message: "Server error. Please try again." });

      db.query("INSERT INTO users (name,email,password) VALUES (?,?,?)", [name, normalizedEmail, hashed], (err2) => {
        if (err2) return res.status(500).json({ message: "Registration failed. Please try again." });
        res.json({ message: "Account created successfully" });
      });
    });
  });
};

// ── LOGIN ─────────────────────────────────────────────────────
exports.login = (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();

  // Pehle users table check karo
  db.query("SELECT * FROM users WHERE LOWER(email)=?", [normalizedEmail], (err, userRows) => {
    if (err) return res.status(500).json({ message: "Server error. Please try again." });

    if (userRows.length) {
      const user = userRows[0];
      bcrypt.compare(password, user.password, (cmpErr, match) => {
        if (cmpErr || !match) return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign(
          { id: user.user_id, role: user.role },
          process.env.JWT_SECRET || "KHAREEDLO_SECRET",
          { expiresIn: "1d" }
        );

        return res.json({
          token,
          user: { id: user.user_id, name: user.name, email: user.email, role: user.role },
        });
      });
      return;
    }

    // Users mein nahi mila — brands table check karo
    db.query("SELECT * FROM brands WHERE LOWER(email)=?", [normalizedEmail], (err2, brandRows) => {
      if (err2) return res.status(500).json({ message: "Server error. Please try again." });

      if (!brandRows.length) {
        return res.status(401).json({ message: "Invalid credentials | or Register First" });
      }

      const brand = brandRows[0];

      if (brand.status !== "APPROVED") {
        return res.status(403).json({ message: "Your brand is pending admin approval." });
      }

      bcrypt.compare(password, brand.password, (cmpErr2, match2) => {
        if (cmpErr2 || !match2) return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign(
          { id: brand.brand_id, role: "brand" },
          process.env.JWT_SECRET || "KHAREEDLO_SECRET",
          { expiresIn: "1d" }
        );

        return res.json({
          token,
          user: {
            id:        brand.brand_id,
            name:      brand.brand_name,
            email:     brand.email,
            role:      "brand",
            brand_id:  brand.brand_id,
            brandName: brand.brand_name,
            logo:      brand.logo,
          },
        });
      });
    });
  });
};