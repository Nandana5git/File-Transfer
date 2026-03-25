require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../models/db");

async function migrate() {
    try {
        console.log("Starting migration for user password reset tokens...");

        await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS reset_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
    `);

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
