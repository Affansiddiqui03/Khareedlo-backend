const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");


const connectDB = require("./config/db"); // MySQL connection
const brandRoutes = require("./routes/brandRoutes");
const outletRoutes = require("./routes/outletRoutes");
const productRoutes = require("./routes/productRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const brandAdminRoutes = require("./routes/brandAdminRoutes");
const posRoutes = require("./routes/posRoutes");
const trendingRoutes = require("./routes/trendingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Connect to MySQL
// connectDB();

// Routes
app.use("/api/home", require("./routes/homeRoutes"));
app.use("/api/auth", authRoutes);
app.use("/api/brands", brandRoutes); // GET brands
app.use("/api/brand", require("./routes/brandRegisterRoutes")); // REGISTER
app.use("/api/outlets", outletRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/user", userRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/brand-admin", brandAdminRoutes);
app.use("/api/pos", posRoutes);
app.use("/api/brand-profile", require("./routes/brandProfileRoutes"));
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/brand", require("./routes/brandDashboardRoutes"));


app.use(
  "/photos",
  express.static(path.join(__dirname, "photos"))
);

// Root route
app.get("/", (req, res) => {
  res.send("Khareedlo Backend API Running...");
});
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
