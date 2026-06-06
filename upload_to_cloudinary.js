// Run from backend ROOT folder:
// node upload_to_cloudinary.js

const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

cloudinary.config({
  cloud_name: "dvq9bh03k",
  api_key: "113532156765553",
  api_secret: "XhSy7ctkUtXXt7YQgRKYVYZJYdY",
});

const PHOTOS_DIR = path.join(__dirname, "photos");

// Only upload the 4 failed images
const FAILED = [
  "ALKARAM - RTS SHIRT, TROUSER & DUPATTA.jpg",
  "ALKARAM - RTW  KURTA & SHALWAR.jpg",
  "ZELLBURY WASH & WEAR KURTA – 2.jpg",
  "ZELLBURY WASH & WEAR KURTA.jpg",
];

function getImages(dir) {
  let results = [];

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      results = results.concat(getImages(full));
    } else {
      const ext = path.extname(item).toLowerCase();

      if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
        results.push(full);
      }
    }
  }

  return results;
}

function createSafePublicId(filename) {
  return filename
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "") // remove unicode chars
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function uploadAll() {
  const allFiles = getImages(PHOTOS_DIR);

  const files = allFiles.filter((f) =>
    FAILED.includes(path.basename(f))
  );

  console.log(`Found ${files.length} failed images\n`);

  const sqlLines = [
    "SET SQL_SAFE_UPDATES = 0;",
    ""
  ];

  let uploaded = 0;

  for (const filePath of files) {
    const fname = path.basename(filePath);
    const nameNoExt = path.parse(fname).name;

    const safeId = createSafePublicId(nameNoExt);

    const publicId = `khareedlo/products/${safeId}`;

    try {
      console.log(`Uploading: ${fname}`);
      console.log(`Public ID: ${publicId}`);

      const result = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
      });

      sqlLines.push(
        `-- ${fname}`
      );

      sqlLines.push(
        `UPDATE products SET image='${result.secure_url}' WHERE image LIKE '%${nameNoExt
          .replace(/'/g, "\\'")
          .substring(0, 20)}%';`
      );

      sqlLines.push("");

      uploaded++;

      console.log(`✅ Success`);
      console.log(result.secure_url);
      console.log("");
    } catch (err) {
      console.log(`❌ Failed: ${fname}`);
      console.log(err.message);
      console.log("");
    }
  }

  sqlLines.push("SET SQL_SAFE_UPDATES = 1;");

  const sqlFile = path.join(
    __dirname,
    "update_product_images_extra.sql"
  );

  fs.writeFileSync(sqlFile, sqlLines.join("\n"));

  console.log("================================");
  console.log(`Uploaded ${uploaded}/${files.length}`);
  console.log(`SQL file: ${sqlFile}`);
  console.log("================================");
}

uploadAll();