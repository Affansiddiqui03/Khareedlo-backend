const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  const [exists] = await db.query(
    "SELECT user_id FROM users WHERE email=?",
    [email]
  );

  if (exists.length) {
    return res.status(400).json({ message: "Email already exists" });
  }

  const hashed = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users (name,email,password) VALUES (?,?,?)",
    [name, email, hashed]
  );

  res.json({ message: "Account created successfully" });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await db.query(
    "SELECT * FROM users WHERE email=?",
    [email]
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
    user: { name: user.name, role: user.role }
  });
};
