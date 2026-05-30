const mysql = require("mysql2");

let pool;

if (process.env.MYSQL_URL) {
  pool = mysql.createPool(process.env.MYSQL_URL);
  console.log("✅ DB: Connected via Railway MYSQL_URL");
} else {
  pool = mysql.createPool({
    host:     process.env.DB_HOST     || "localhost",
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASS     || "Nazpanmasala2003.",
    database: process.env.DB_NAME     || "khareedlo_db",
    port:     parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  });
  console.log("✅ DB: Connected to localhost/khareedlo_db");
}

pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err.message);
  } else {
    console.log("✅ DB Connection Successful");
    connection.release();
  }
});

module.exports = pool;