const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const vaultController = require("../controllers/vaultController");

// Private: Create a vault
router.post("/create", authenticateToken, vaultController.createVault);

// Public: Get vault info
router.get("/share/:token", vaultController.getVaultByToken);

// Public: Verify vault password
router.post("/share/verify/:token", vaultController.verifyVault);

// Public: Download file from vault
router.get("/share/download/:vaultAccessToken/:fileId", vaultController.downloadVaultFile);

// Private: List user's vaults
router.get("/my-vaults", authenticateToken, vaultController.getUserVaults);

module.exports = router;
