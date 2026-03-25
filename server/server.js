const express = require("express");
const cors = require("cors");
const fileRoutes = require("./routes/fileRoutes");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
const uploadRoutes = require("./routes/uploadRoutes");
const vaultRoutes = require("./routes/vaultRoutes");
app.use("/api/uploads", uploadRoutes);
app.use("/api/vaults", vaultRoutes);



app.get("/", (req, res) => {
  res.send("Secure File Transfer Backend Running...");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Periodic Cleanups
  const uploadController = require("./controllers/uploadController");

  // Cleanup abandoned upload sessions every 6 hours
  setInterval(() => {
    uploadController.cleanupAbandonedSessions();
  }, 6 * 60 * 60 * 1000);

  // Cleanup expired files every hour
  setInterval(() => {
    uploadController.cleanupExpiredFiles();
  }, 1 * 60 * 60 * 1000);

  // Run once on startup
  uploadController.cleanupAbandonedSessions();
  uploadController.cleanupExpiredFiles();
});
