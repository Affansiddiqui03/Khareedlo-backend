const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db"); // MySQL connection
const brandRoutes = require("./routes/brandRoutes");
const outletRoutes = require("./routes/outletRoutes");
const productRoutes = require("./routes/productRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const brandAdminRoutes = require("./routes/brandAdminRoutes");
const refundRoutes = require("./routes/refundRoutes");
const posRoutes = require("./routes/posRoutes");
const trackingRoutes = require("./routes/trackingRoutes");
const trendingRoutes = require("./routes/trendingRoutes");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MySQL
// connectDB();

// Routes
app.use("/api/refunds", refundRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/outlets", outletRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/user", userRoutes);
app.use("/api/track", trackingRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/brand-admin", brandAdminRoutes);
app.use("/api/pos", posRoutes);
app.use("/api/brand-profile", require("./routes/brandProfileRoutes"));

// Root route
app.get("/", (req, res) => {
  res.send("Khareedlo Backend API Running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
