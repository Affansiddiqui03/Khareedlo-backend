const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const app = express();

const connectDB = require("./config/db");
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
const ratingsRoutes = require("./routes/ratingsRoutes");
const contactRoutes = require("./routes/contactRoutes");
const syncRoutes = require("./routes/syncRoutes");
const orderRoutes = require("./routes/orderRoutes");
// Middleware
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));


app.use("/api/home", require("./routes/homeRoutes"));
app.use("/api/auth", authRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/brand", require("./routes/brandRegisterRoutes"));
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
app.use("/api/contact", contactRoutes);

app.use("/api/ratings", require("./routes/ratingsRoutes"));
app.use("/api/sync", syncRoutes);
app.use("/api/orders", orderRoutes);


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
