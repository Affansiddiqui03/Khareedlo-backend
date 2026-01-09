const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const token = req.header("x-auth-token");
  if (!token)
    return res.status(401).json({ msg: "No token, access denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "brand-admin")
      return res.status(403).json({ msg: "Unauthorized - Not a brand admin" });

    req.brandAdmin = decoded;
    next();
  } catch (err) {
    res.status(400).json({ msg: "Invalid token" });
  }
};
