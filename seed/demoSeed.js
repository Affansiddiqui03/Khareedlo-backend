const Brand = require("../models/Brand");
const Product = require("../models/Product");

module.exports = async () => {
  await Brand.deleteMany();
  await Product.deleteMany();

  const khaadi = await Brand.create({
    name: "Khaadi",
    city: "Karachi",
    category: "Women",
    logo: "/logos/khaadi.png",
    description: "Premium eastern wear",
  });

  const jdot = await Brand.create({
    name: "J.",
    city: "Lahore",
    category: "Men",
    logo: "/logos/j.png",
    description: "Modern traditional wear",
  });
await Product.insertMany([
  {
    title: "Printed Lawn Suit",
    price: 5200,
    image: "/products/lawn.jpg",
    brand: khaadi._id,
  },
  {
    title: "Summer Kurta",
    price: 4300,
    image: "/products/kurta.jpg",
    brand: jdot._id,
  },
]);
  console.log("✅ DEMO DATA READY");
};
