// Railway MYSQL_URL automatically mil jaata hai environment se
if (process.env.MYSQL_URL) {
  connection = mysql.createPool(process.env.MYSQL_URL + "?ssl={rejectUnauthorized:true}");
} else {
  // local development
  connection = mysql.createPool({ host, user, password, database, port });
}