const express  = require("express");
const router   = express.Router();
const db       = require("../config/db");
const { uploadLogo } = require("../config/cloudinary");
const { sendAdminNewBrandNotification } = require("../services/emailService");

const VALID_TLDS = new Set([
  "com","net","org","edu","gov","io","co","pk","uk","us","ca","au",
  "de","fr","in","ae","sa","bd","np","lk","mv","af","iq","store",
  "online","shop","info","biz","me","app","dev","tech","digital",
  "web","site","blog","news","media","tv","fm","am","email","mail",
  "academy","agency","art","asia","auto","cafe","care","city","click",
  "cloud","club","company","cool","design","eco","events","expert",
  "express","family","fashion","finance","fit","food","fun","gallery",
  "global","health","help","home","host","house","inc","jobs","land",
  "legal","life","live","local","ltd","luxury","market","money","mobi",
  "network","ninja","one","page","pay","pet","photo","photography",
  "photos","pizza","place","plus","pro","properties","pub","rent",
  "restaurant","school","services","social","software","solutions",
  "space","style","support","systems","tax","team","today","tools",
  "travel","ventures","video","vision","watch","world","zone"
]);

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  const regex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}$/;
  if (!regex.test(trimmed)) return false;
  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local) return false;
  if (!domain.includes(".")) return false;
  if (trimmed.includes("..")) return false;
  const domainParts = domain.split(".");
  if (domainParts.some(p => p.length === 0)) return false;
  const tld = domainParts[domainParts.length - 1];
  if (tld.length === 2) return true;
  return VALID_TLDS.has(tld);
}

const ADMIN_EMAIL = "khareedlo@gmail.com";

// ── POST /api/brand/register ──────────────────────────────────
router.post("/register", uploadLogo.single("logo"), async (req, res) => {
  const { brandName, email, password, contact, website } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();
  const logo = req.file ? req.file.path : null;

  if (!brandName || !brandName.trim())
    return res.status(400).json({ message: "Brand name is required" });
  if (!isValidEmail(normalizedEmail))
    return res.status(400).json({ message: "Please enter a valid email address (e.g. brand@gmail.com)" });
  if (!password || password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  if (normalizedEmail === ADMIN_EMAIL)
    return res.status(400).json({ message: "This email address is not available for registration." });

  try {
    // FIX 1: use db.promise().query() — callback pool doesn't support await
    // FIX 2: check customers table (NOT users — users table doesn't exist in schema)

    // Check if email already used by a brand
    const [brandExists] = await db.promise().query(
      "SELECT brand_id FROM brands WHERE LOWER(email)=?",
      [normalizedEmail]
    );
    if (brandExists.length) {
      return res.status(400).json({ message: "A brand with this email already exists. Please login or use a different email." });
    }

    // Check if email already used by a customer
    const [custExists] = await db.promise().query(
      "SELECT customer_id FROM customers WHERE LOWER(email)=?",
      [normalizedEmail]
    );
    if (custExists.length) {
      return res.status(400).json({ message: "This email is already registered as a customer account. Please use a different email for your brand." });
    }

    // Insert brand
    await db.promise().query(
      `INSERT INTO brands (brand_name, email, password, contact, website, logo, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [brandName.trim(), normalizedEmail, password, contact || null, website || null, logo]
    );

    // Notify admin (non-fatal)
    sendAdminNewBrandNotification(brandName.trim(), normalizedEmail).catch(() => {});

    res.json({ message: "Brand registered, awaiting admin approval" });

  } catch (err) {
    console.error("Brand Register Error:", err.message, err.stack);
    // Return actual error in dev, generic in prod
    return res.status(500).json({ message: "Registration failed: " + err.message });
  }
});

module.exports = router;