const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const router = express.Router();
const upload = require("../utils/multerConfig");
const fileController = require("../controllers/fileController");

router.post("/upload", verifyToken, upload.single("file"), fileController.uploadFile);
router.get("/myfiles", verifyToken, fileController.getUserFiles);
router.get("/download/:id", verifyToken, fileController.downloadFile);

module.exports = router;

