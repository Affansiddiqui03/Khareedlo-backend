const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const ADMIN_EMAIL = "khareedlo@gmail.com";

exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();

  // Block admin email from being registered as a user
  if (normalizedEmail === ADMIN_EMAIL) {
    return res.status(400).json({ message: "This email address is not available for registration." });
  }

  const [exists] = await db.query(
    "SELECT user_id FROM users WHERE LOWER(email)=?",
    [normalizedEmail]
  );

  if (exists.length) {
    return res.status(400).json({ message: "This email is already registered. Please login or use a different email." });
  }

  const hashed = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users (name,email,password) VALUES (?,?,?)",
    [name, normalizedEmail, hashed]
  );

  res.json({ message: "Account created successfully" });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();

  const [rows] = await db.query(
    "SELECT * FROM users WHERE LOWER(email)=?",
    [normalizedEmail]
  );

  if (!rows.length) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.user_id, role: user.role },
    "KHAREEDLO_SECRET",
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: { id: user.user_id, name: user.name, email: user.email, role: user.role }
  });
};