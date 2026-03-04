const express = require("express");
const router = express.Router();
const multer = require("multer");
const authenticateToken = require("../middleware/authMiddleware");
const uploadController = require("../controllers/uploadController");

const storage = multer.memoryStorage();
const upload = multer({ storage });

// For Chunks: Use disk storage to stream directly to disk (Direct Streaming)
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/temp/multer";
    const fs = require("fs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const chunkUpload = multer({ storage: chunkStorage });
// const { downloadFile } = require("../controllers/uploadController");
const {
  deleteFile,
  downloadFile,
  getDashboardStats,
  getFileByToken,
  downloadByToken,
  verifyDownload,
  streamFile
} = require("../controllers/uploadController");

// Initiate upload
router.post("/initiate", authenticateToken, uploadController.initiateUpload);

// Upload chunk
router.post(
  "/:uploadId/chunk",
  authenticateToken,
  chunkUpload.single("chunk"),
  uploadController.uploadChunk
);

// ✅ IMPORTANT: Put /my-files BEFORE /:uploadId/status
router.get("/my-files", authenticateToken, uploadController.getUserFiles);
router.get("/stats", authenticateToken, getDashboardStats);

// Upload status
router.get("/:uploadId/status", authenticateToken, uploadController.getUploadStatus);
router.get("/download/:id", authenticateToken, downloadFile);
router.get("/download/verify/:id", authenticateToken, uploadController.verifyDownload);

router.delete("/delete/:id", authenticateToken, deleteFile);

// Public Link Sharing Routes (No authenticateToken)
router.get("/share/:token", getFileByToken);
router.post("/share/download/:token", downloadByToken);
router.post("/share/verify/:token", uploadController.verifyDownload);
router.get("/share/stream/:streamToken", uploadController.streamFile);

module.exports = router;
