// server.js
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Default test route
app.get("/", (req, res) => {
  res.send("✅ KHAREEDLO Backend is running successfully!");
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
