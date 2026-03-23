const pool = require("../models/db");
const { encryptBuffer, decryptBuffer } = require("../utils/cryptoUtils");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");


// ======================
// Upload Encrypted File
// ======================
exports.uploadFile = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Encrypt file buffer
    const { iv, encryptedData, authTag } = encryptBuffer(req.file.buffer);

    const uniqueName = uuidv4() + ".enc";
    const filePath = path.join(__dirname, "../uploads", uniqueName);

    // Store IV + encrypted data together
    const finalBuffer = Buffer.concat([iv, authTag, encryptedData]);

    fs.writeFileSync(filePath, finalBuffer);

    // Save file metadata in DB
    await pool.query(
      "INSERT INTO files (user_id, filename, original_name, size) VALUES ($1, $2, $3, $4)",
      [userId, uniqueName, req.file.originalname, req.file.size]
    );

    res.status(201).json({ message: "Encrypted file uploaded successfully" });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};


// ======================
// Get User Files
// ======================
exports.getUserFiles = async (req, res) => {
  try {
    const userId = req.user.userId;

    const files = await pool.query(
      "SELECT id, filename, original_name, size, upload_date FROM files WHERE user_id = $1 ORDER BY upload_date DESC",
      [userId]
    );

    res.json(files.rows);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};


// ======================
// Download & Decrypt File
// ======================
exports.downloadFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const fileId = req.params.id;

    // Check file ownership
    const fileResult = await pool.query(
      "SELECT * FROM files WHERE id = $1 AND user_id = $2",
      [fileId, userId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: "File not found or unauthorized" });
    }

    const file = fileResult.rows[0];
    const filePath = path.join(__dirname, "../uploads", file.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Read only the header to extract IV and authTag (without loading entire file)
    const headerBuffer = Buffer.alloc(28); // 12 bytes IV + 16 bytes authTag
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, headerBuffer, 0, 28, 0);
    fs.closeSync(fd);

    const iv = headerBuffer.slice(0, 12);
    const authTag = headerBuffer.slice(12, 28);

    // Import streaming decryption helper
    const { createDecipherStream } = require("../utils/cryptoUtils");
    const decipherStream = createDecipherStream(iv, authTag);

    // Create file stream starting after header (skip first 28 bytes)
    const fileStream = fs.createReadStream(filePath, { start: 28 });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.original_name}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    // Stream: fileStream → decrypt → response
    // Only small chunks in memory at a time, regardless of file size
    fileStream.pipe(decipherStream).pipe(res);

    // Error handling
    fileStream.on("error", (err) => {
      console.error("File stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Download error" });
      }
    });

    decipherStream.on("error", (err) => {
      console.error("Decryption error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Decryption error" });
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};
