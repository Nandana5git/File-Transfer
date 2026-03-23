require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../models/db");

async function migrate() {
    try {
        console.log("Starting migration for vault recipients...");

        await pool.query(`
      ALTER TABLE vaults ADD COLUMN IF NOT EXISTS receiver_email TEXT;
    `);

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
