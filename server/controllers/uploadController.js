const pool = require("../models/db");
const {
  createCipherStream,
  generateSHA256,
  getIVLength
} = require("../utils/cryptoUtils");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");

const TEMP_DIR = path.join(__dirname, "../uploads/temp");
const UPLOADS_DIR = path.join(__dirname, "../uploads");

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const bcrypt = require("bcrypt");

// Concurrency Control (Semaphore)
let activeStreams = 0;
const MAX_CONCURRENT_STREAMS = 50;

// ==========================
// Initiate Upload
// ==========================
exports.initiateUpload = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      originalName,
      totalChunks,
      expiryDate,
      password,
      maxDownloads,
      receiverEmail,
      fileSize, // Client should send this
      description,
      displayName
    } = req.body;

    // Check Storage Limit (50GB)
    const statsResult = await pool.query(
      "SELECT COALESCE(SUM(size), 0) as used FROM files WHERE user_id = $1",
      [userId]
    );
    const usedStorage = parseInt(statsResult.rows[0].used);
    const LIMIT = 50 * 1024 * 1024 * 1024;

    if (fileSize && (usedStorage + fileSize > LIMIT)) {
      return res.status(403).json({ error: "Storage limit exceeded (50GB). Please delete some files." });
    }

    const uploadId = uuidv4();

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    await pool.query(
      `INSERT INTO upload_sessions (
        id, user_id, original_name, total_chunks, uploaded_chunks, status, 
        expiry_date, password_hash, max_downloads, receiver_email, description, display_name
      )
       VALUES ($1, $2, $3, $4, 0, 'pending', $5, $6, $7, $8, $9, $10)`,
      [
        uploadId, userId, originalName, totalChunks,
        expiryDate || null, passwordHash, maxDownloads || null, receiverEmail || null, description || null, displayName || null
      ]
    );

    res.json({ uploadId });

  } catch (err) {
    console.error("INITIATE UPLOAD ERROR:", err);
    res.status(500).json({ error: "Failed to initiate upload" });
  }
};

// ==========================
// Upload Chunk
// ==========================
exports.uploadChunk = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { uploadId } = req.params;
    const { chunkIndex } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No chunk uploaded" });
    }

    if (activeStreams >= MAX_CONCURRENT_STREAMS) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(429).json({ error: "Server busy. Please try again in a few seconds." });
    }

    activeStreams++;

    try {
      const sessionResult = await pool.query(
        "SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2",
        [uploadId, userId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      const session = sessionResult.rows[0];
      const uploadTempPath = path.join(TEMP_DIR, uploadId);
      if (!fs.existsSync(uploadTempPath)) fs.mkdirSync(uploadTempPath, { recursive: true });

      const chunkPath = path.join(uploadTempPath, `${chunkIndex}.part`);
      const alreadyReceived = fs.existsSync(chunkPath);

      if (fs.existsSync(req.file.path)) {
        fs.renameSync(req.file.path, chunkPath);
      }

      let uploadedChunks = session.uploaded_chunks;
      if (!alreadyReceived) {
        const updateResult = await pool.query(
          "UPDATE upload_sessions SET uploaded_chunks = uploaded_chunks + 1 WHERE id = $1 RETURNING uploaded_chunks",
          [uploadId]
        );
        uploadedChunks = updateResult.rows[0].uploaded_chunks;
      }

      if (uploadedChunks === session.total_chunks) {
        finalizeUpload(uploadId, userId, session.original_name).catch(err => {
          console.error("BACKGROUND FINALIZE ERROR:", err);
        });
        return res.json({
          message: "All chunks received. Processing file...",
          progress: uploadedChunks,
          status: "processing"
        });
      }

      res.json({ message: "Chunk uploaded successfully", progress: uploadedChunks, status: "pending" });
    } finally {
      activeStreams = Math.max(0, activeStreams - 1);
    }
  } catch (err) {
    console.error("UPLOAD CHUNK ERROR:", err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (!res.headersSent) res.status(500).json({ error: "Chunk upload failed" });
  }
};

// ==========================
// Finalize Upload (Streaming Reassembly & Encryption)
// ==========================
const finalizeUpload = async (uploadId, userId, originalName) => {
  const uploadTempPath = path.join(TEMP_DIR, uploadId);
  const finalFilename = uuidv4() + ".enc";
  const finalPath = path.join(UPLOADS_DIR, finalFilename);

  try {
    const sessionResult = await pool.query(
      `SELECT * FROM upload_sessions WHERE id = $1`,
      [uploadId]
    );
    const session = sessionResult.rows[0];

    // 1. Generate IV and write to file start
    const iv = crypto.randomBytes(12);
    fs.writeFileSync(finalPath, iv);

    const cipher = createCipherStream(iv);
    const hash = crypto.createHash("sha256");

    // streaming reassembly using Async Iterator & pipeline
    async function* chunkGenerator() {
      for (let i = 0; i < session.total_chunks; i++) {
        const chunkPath = path.join(uploadTempPath, `${i}.part`);
        if (!fs.existsSync(chunkPath)) throw new Error(`Missing chunk ${i}`);

        const chunkStream = fs.createReadStream(chunkPath);
        for await (const chunk of chunkStream) {
          hash.update(chunk);
          yield chunk;
        }
        fs.unlinkSync(chunkPath);
      }
    }

    await pipeline(
      chunkGenerator(),
      cipher,
      fs.createWriteStream(finalPath, { flags: 'a' }) // Append to IV
    );

    const authTag = cipher.getAuthTag();
    fs.appendFileSync(finalPath, authTag);

    const fileHash = hash.digest("hex");
    const stats = fs.statSync(finalPath);
    const shareToken = uuidv4();

    // 7. Save to database with metadata
    await pool.query(
      `INSERT INTO files (
        user_id, filename, original_name, size, checksum, status, 
        expiry_date, password_hash, max_downloads, receiver_email, share_token, description, display_name
      )
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10, $11, $12)`,
      [
        userId, finalFilename, originalName, stats.size, fileHash,
        session.expiry_date, session.password_hash, session.max_downloads,
        session.receiver_email, shareToken, session.description, session.display_name
      ]
    );

    fs.rmSync(uploadTempPath, { recursive: true, force: true });
    await pool.query(
      `UPDATE upload_sessions SET status = 'completed' WHERE id = $1`,
      [uploadId]
    );

  } catch (err) {
    console.error("FINALIZE UPLOAD ERROR:", err);
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    await pool.query(
      `UPDATE upload_sessions SET status = 'failed' WHERE id = $1`,
      [uploadId]
    );
  }
};

// ==========================
// Check processing status
// ==========================
exports.getUploadStatus = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user.userId;

    const sessionResult = await pool.query(
      "SELECT status, uploaded_chunks, total_chunks FROM upload_sessions WHERE id = $1 AND user_id = $2",
      [uploadId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessionResult.rows[0];

    // If completed, find the file record to get share token
    let shareToken = null;
    if (session.status === 'completed') {
      const fileResult = await pool.query(
        "SELECT share_token FROM files WHERE user_id = $1 ORDER BY upload_date DESC LIMIT 1",
        [userId]
      );
      if (fileResult.rows.length > 0) {
        shareToken = fileResult.rows[0].share_token;
      }
    }

    res.json({ ...session, shareToken });

  } catch (err) {
    console.error("GET STATUS ERROR:", err);
    res.status(500).json({ error: "Failed to get status" });
  }
};

// ==========================
// Dashboard Stats
// ==========================
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const statsResult = await pool.query(
      `SELECT 
        COALESCE(SUM(size), 0) as used_storage,
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE expiry_date > NOW() OR expiry_date IS NULL) as active_files,
        COUNT(*) FILTER (WHERE expiry_date <= NOW()) as expired_files,
        MAX(upload_date) as last_upload
       FROM files 
       WHERE user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0];
    const totalStorageLimit = 50 * 1024 * 1024 * 1024; // 50GB in bytes

    res.json({
      totalStorage: totalStorageLimit,
      usedStorage: parseInt(stats.used_storage),
      totalFiles: parseInt(stats.total_files),
      activeFiles: parseInt(stats.active_files),
      expiredFiles: parseInt(stats.expired_files),
      lastUpload: stats.last_upload
    });

  } catch (err) {
    console.error("STATS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

// ==========================
// Public: Get File Info by Token
// ==========================
exports.getFileByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT id, original_name, size, expiry_date, description, display_name,
              password_hash IS NOT NULL as password_required,
              receiver_email IS NOT NULL as email_required
       FROM files 
       WHERE share_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found or link broken" });
    }

    const file = result.rows[0];

    // Check expiry
    if (file.expiry_date && new Date(file.expiry_date) <= new Date()) {
      return res.status(410).json({ error: "This link has expired" });
    }

    res.json(file);

  } catch (err) {
    console.error("GET FILE BY TOKEN ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ==========================
// Public: Download by Token
// ==========================
exports.downloadByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, email } = req.body;

    const result = await pool.query(
      "SELECT * FROM files WHERE share_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = result.rows[0];

    // Check expiry
    if (file.expiry_date && new Date(file.expiry_date) <= new Date()) {
      return res.status(410).json({ error: "File has expired" });
    }

    // Check max downloads
    if (file.max_downloads !== null && file.download_count >= file.max_downloads) {
      return res.status(403).json({ error: "Download limit reached" });
    }

    // Check email requirement
    if (file.receiver_email) {
      if (!email) return res.status(401).json({ error: "Receiver email required" });
      const allowedEmails = file.receiver_email.split(',').map(e => e.trim().toLowerCase());
      if (!allowedEmails.includes(email.toLowerCase())) {
        return res.status(403).json({ error: "Access denied: Email mismatch" });
      }
    }

    // Check password
    if (file.password_hash) {
      if (!password) return res.status(401).json({ error: "Password required" });
      const match = await bcrypt.compare(password, file.password_hash);
      if (!match) return res.status(401).json({ error: "Invalid password" });
    }

    const filePath = path.join(UPLOADS_DIR, file.filename);
    const stats = fs.statSync(filePath);
    const ivLength = 12;
    const tagLength = 16;

    const fd = fs.openSync(filePath, 'r');
    const iv = Buffer.alloc(ivLength);
    fs.readSync(fd, iv, 0, ivLength, 0);
    const authTag = Buffer.alloc(tagLength);
    fs.readSync(fd, authTag, 0, tagLength, stats.size - tagLength);
    fs.closeSync(fd);

    const { createDecipherStream } = require("../utils/cryptoUtils");
    const decipher = createDecipherStream(iv, authTag);

    // Increment download count
    await pool.query(
      "UPDATE files SET download_count = download_count + 1 WHERE id = $1",
      [file.id]
    );

    res.setHeader("Content-Disposition", `attachment; filename="${file.original_name}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    const readStream = fs.createReadStream(filePath, {
      start: ivLength,
      end: stats.size - tagLength - 1
    });

    await pipeline(readStream, decipher, res);

  } catch (err) {
    console.error("DOWNLOAD BY TOKEN ERROR:", err);
    if (!res.headersSent) res.status(500).json({ error: "Download failed" });
  }
};

/**
 * Temporary Download Tokens (In-memory for security)
 * Format: { token: { fileId, expiry } }
 */
const downloadTokens = new Map();

// ==========================
// Verify & Generate Stream Token
// ==========================
exports.verifyDownload = async (req, res) => {
  try {
    const { token, id } = req.params; // folder or id
    const { password, email } = req.body;
    const userId = req.user?.userId;

    let result;
    if (token) {
      result = await pool.query("SELECT * FROM files WHERE share_token = $1", [token]);
    } else if (id) {
      result = await pool.query("SELECT * FROM files WHERE id = $1 AND user_id = $2", [id, userId]);
    }

    if (!result || result.rows.length === 0) return res.status(404).json({ error: "File not found" });
    const file = result.rows[0];

    // Expiry check
    if (file.expiry_date && new Date(file.expiry_date) <= new Date()) {
      return res.status(410).json({ error: "File has expired" });
    }

    // Auth check (only for share links)
    if (token) {
      if (file.receiver_email) {
        if (!email) return res.status(401).json({ error: "Receiver email required" });
        const allowedEmails = file.receiver_email.split(',').map(e => e.trim().toLowerCase());
        if (!allowedEmails.includes(email.toLowerCase())) {
          return res.status(403).json({ error: "Access denied: Email mismatch" });
        }
      }
      if (file.password_hash) {
        if (!password) return res.status(401).json({ error: "Password required" });
        const match = await bcrypt.compare(password, file.password_hash);
        if (!match) return res.status(401).json({ error: "Invalid password" });
      }
    }

    // Generate stream token (valid for 1 minute)
    const streamToken = uuidv4();
    downloadTokens.set(streamToken, { fileId: file.id, expiry: Date.now() + 60000 });

    res.json({ streamToken });

  } catch (err) {
    console.error("VERIFY DOWNLOAD ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ==========================
// Stream File by Token
// ==========================
exports.streamFile = async (req, res) => {
  try {
    const { streamToken } = req.params;
    const session = downloadTokens.get(streamToken);

    if (!session || session.expiry < Date.now()) {
      downloadTokens.delete(streamToken);
      return res.status(403).send("Download link expired or invalid");
    }

    const fileId = session.fileId;
    downloadTokens.delete(streamToken); // One-time use

    const result = await pool.query("SELECT * FROM files WHERE id = $1", [fileId]);
    if (result.rows.length === 0) return res.status(404).send("File not found");
    const file = result.rows[0];

    const filePath = path.join(UPLOADS_DIR, file.filename);
    const stats = fs.statSync(filePath);
    const ivLength = 12;
    const tagLength = 16;

    const fd = fs.openSync(filePath, 'r');
    const iv = Buffer.alloc(ivLength);
    fs.readSync(fd, iv, 0, ivLength, 0);
    const authTag = Buffer.alloc(tagLength);
    fs.readSync(fd, authTag, 0, tagLength, stats.size - tagLength);
    fs.closeSync(fd);

    const { createDecipherStream } = require("../utils/cryptoUtils");
    const decipher = createDecipherStream(iv, authTag);

    await pool.query("UPDATE files SET download_count = download_count + 1 WHERE id = $1", [file.id]);

    res.setHeader("Content-Disposition", `attachment; filename="${file.original_name}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    const readStream = fs.createReadStream(filePath, { start: ivLength, end: stats.size - tagLength - 1 });
    await pipeline(readStream, decipher, res);

  } catch (err) {
    console.error("STREAM ERROR:", err);
    if (!res.headersSent) res.status(500).send("Download failed");
  }
};



// ==========================
// Download & Decrypt File (Streaming)
// ==========================
exports.downloadFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const fileId = req.params.id;

    const result = await pool.query(
      "SELECT * FROM files WHERE id = $1 AND user_id = $2",
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileInfo = result.rows[0];
    const filePath = path.join(UPLOADS_DIR, fileInfo.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Physical file not found" });
    }

    const stats = fs.statSync(filePath);
    const ivLength = 12;
    const tagLength = 16;

    // 1. Read IV from beginning
    const fd = fs.openSync(filePath, 'r');
    const iv = Buffer.alloc(ivLength);
    fs.readSync(fd, iv, 0, ivLength, 0);

    // 2. Read Auth Tag from end
    const authTag = Buffer.alloc(tagLength);
    fs.readSync(fd, authTag, 0, tagLength, stats.size - tagLength);
    fs.closeSync(fd);

    // 3. Setup Decipher
    const { createDecipherStream } = require("../utils/cryptoUtils");
    const decipher = createDecipherStream(iv, authTag);

    // 4. Set Response Headers
    res.setHeader("Content-Disposition", `attachment; filename="${fileInfo.original_name}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    // 5. Pipe: FileStream (middle part) -> Decipher -> Response
    const readStream = fs.createReadStream(filePath, {
      start: ivLength,
      end: stats.size - tagLength - 1
    });

    await pipeline(readStream, decipher, res);

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Download failed" });
    }
  }
};

// ==========================
// Get All Files of Logged User
// ==========================
exports.getUserFiles = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, filename, original_name, size, upload_date, 
              checksum, status, expiry_date, download_count, 
              max_downloads, receiver_email, share_token, description, display_name
       FROM files 
       WHERE user_id = $1 
       ORDER BY upload_date DESC`,
      [userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("GET FILES ERROR:", err);
    res.status(500).json({ error: "Failed to fetch files" });
  }
};

// ==========================
// Delete File
// ==========================
exports.deleteFile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const fileId = req.params.id;

    const result = await pool.query(
      "SELECT * FROM files WHERE id = $1 AND user_id = $2",
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = result.rows[0];
    const filePath = path.join(UPLOADS_DIR, file.filename);

    // Delete file from disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from DB
    await pool.query("DELETE FROM files WHERE id = $1", [fileId]);

    res.json({ message: "File deleted successfully" });

  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Delete failed" });
  }
};
// ==========================
// Cleanup Abandoned Sessions (> 24h)
// ==========================
exports.cleanupAbandonedSessions = async () => {
  try {
    const result = await pool.query(
      `SELECT id FROM upload_sessions 
       WHERE status = 'pending' 
       AND created_at < NOW() - INTERVAL '24 hours'`
    );

    for (const row of result.rows) {
      const uploadId = row.id;
      const tempPath = path.join(TEMP_DIR, uploadId);
      if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { recursive: true, force: true });
      }
      await pool.query("DELETE FROM upload_sessions WHERE id = $1", [uploadId]);
      console.log(`Cleaned up abandoned session: ${uploadId}`);
    }
  } catch (err) {
    console.error("CLEANUP ERROR:", err);
  }
};
