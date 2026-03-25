const pool = require("../models/db");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const sgMail = require("@sendgrid/mail");

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const UPLOADS_DIR = path.join(__dirname, "../uploads");

// Create Vault
exports.createVault = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, description, password, expiryDate, fileIds, receiverEmail } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: "No files selected for the vault" });
        }

        const vaultId = uuidv4();
        const shareToken = uuidv4();
        let passwordHash = null;

        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        // Insert vault
        await pool.query(
            `INSERT INTO vaults (id, user_id, name, description, password_hash, share_token, expiry_date, receiver_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [vaultId, userId, name, description, passwordHash, shareToken, expiryDate || null, receiverEmail || null]
        );

        // Link files to vault
        const fileLinkPromises = fileIds.map(fileId =>
            pool.query("INSERT INTO vault_files (vault_id, file_id) VALUES ($1, $2)", [vaultId, fileId])
        );
        await Promise.all(fileLinkPromises);

        // 4. Send Email Notification
        if (receiverEmail && process.env.SENDGRID_API_KEY) {
            const vaultLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/receive-vault/${shareToken}`;
            const msg = {
                to: receiverEmail,
                from: process.env.EMAIL_FROM || "noreply@securetransfer.com",
                subject: `You've been invited to a secure vault: ${name} - SecureTransfer`,
                text: `Hello,\n\nYou have been invited to a secure vault "${name}" via SecureTransfer.\n\nDescription: ${description || "No description provided."}\n\nYou can access the vault here: ${vaultLink}\n\n${password ? "Note: This vault is password protected. Please contact the sender for the password." : "No password is required for this vault."}\n\nThis vault will expire on: ${expiryDate ? new Date(expiryDate).toLocaleString() : "Never"}.\n\nBest,\nSecureTransfer Team`,
                html: `<h3>Hello,</h3>
                       <p>You have been invited to a secure vault <strong>"${name}"</strong> via SecureTransfer.</p>
                       <p><strong>Description:</strong> ${description || "No description provided."}</p>
                       <p>You can access the vault here: <a href="${vaultLink}">${vaultLink}</a></p>
                       <p>${password ? "<strong>Note:</strong> This vault is password protected. Please contact the sender for the password." : "No password is required for this vault."}</p>
                       <p>This vault will expire on: <strong>${expiryDate ? new Date(expiryDate).toLocaleString() : "Never"}</strong>.</p>
                       <p>Best,<br>SecureTransfer Team</p>`,
            };

            try {
                await sgMail.send(msg);
                console.log(`Notification email sent to ${receiverEmail} for vault ${vaultId}`);
            } catch (emailErr) {
                console.error("FAILED TO SEND VAULT NOTIFICATION EMAIL:", emailErr);
            }
        }

        res.status(201).json({ vaultId, shareToken });

    } catch (err) {
        console.error("CREATE VAULT ERROR:", err);
        res.status(500).json({ error: "Failed to create vault" });
    }
};

// Get Vault Info by Token
exports.getVaultByToken = async (req, res) => {
    try {
        const { token } = req.params;

        const vaultResult = await pool.query(
            `SELECT id, name, description, expiry_date, 
              password_hash IS NOT NULL as password_required,
              receiver_email IS NOT NULL as email_required
       FROM vaults 
       WHERE share_token = $1`,
            [token]
        );

        if (vaultResult.rows.length === 0) {
            return res.status(404).json({ error: "Vault not found" });
        }

        const vault = vaultResult.rows[0];

        // Check expiry
        if (vault.expiry_date && new Date(vault.expiry_date) <= new Date()) {
            return res.status(410).json({ error: "This vault has expired" });
        }

        // Fetch files in vault (only metadata)
        const filesResult = await pool.query(
            `SELECT f.id, f.original_name, f.display_name, f.size
       FROM files f
       JOIN vault_files vf ON f.id = vf.file_id
       WHERE vf.vault_id = $1`,
            [vault.id]
        );

        res.json({ ...vault, files: filesResult.rows });

    } catch (err) {
        console.error("GET VAULT ERROR:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Verify Vault Password & Generate Stream Token
// Note: We use a similar mechanism as verifyDownload
const downloadTokens = new Map();

exports.verifyVault = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, email } = req.body;

        const vaultResult = await pool.query("SELECT * FROM vaults WHERE share_token = $1", [token]);
        if (vaultResult.rows.length === 0) return res.status(404).json({ error: "Vault not found" });
        const vault = vaultResult.rows[0];

        if (vault.password_hash) {
            if (!password) return res.status(401).json({ error: "Password required" });
            const match = await bcrypt.compare(password, vault.password_hash);
            if (!match) return res.status(401).json({ error: "Invalid password" });
        }

        if (vault.receiver_email) {
            if (!email) return res.status(401).json({ error: "Receiver email required" });
            const allowedEmails = vault.receiver_email.split(',').map(e => e.trim().toLowerCase());
            if (!allowedEmails.includes(email.trim().toLowerCase())) {
                return res.status(403).json({ error: "Email not authorized for this vault" });
            }
        }

        // Generate access token for this vault session (valid for 10 minutes)
        const vaultAccessToken = uuidv4();
        downloadTokens.set(vaultAccessToken, { vaultId: vault.id, expiry: Date.now() + 600000 });

        res.json({ vaultAccessToken });

    } catch (err) {
        console.error("VERIFY VAULT ERROR:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Download File from Vault
exports.downloadVaultFile = async (req, res) => {
    try {
        const { vaultAccessToken, fileId } = req.params;
        const session = downloadTokens.get(vaultAccessToken);

        if (!session || session.expiry < Date.now()) {
            return res.status(403).send("Vault session expired or invalid");
        }

        // Verify file belongs to vault
        const linkCheck = await pool.query(
            "SELECT * FROM vault_files WHERE vault_id = $1 AND file_id = $2",
            [session.vaultId, fileId]
        );
        if (linkCheck.rows.length === 0) return res.status(403).send("Unauthorized file access");

        const fileResult = await pool.query("SELECT * FROM files WHERE id = $1", [fileId]);
        if (fileResult.rows.length === 0) return res.status(404).send("File not found");
        const file = fileResult.rows[0];

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
        await pool.query("UPDATE vaults SET download_count = download_count + 1 WHERE id = $1", [session.vaultId]);

        res.setHeader("Content-Disposition", `attachment; filename="${file.original_name}"`);
        res.setHeader("Content-Type", "application/octet-stream");

        const readStream = fs.createReadStream(filePath, { start: ivLength, end: stats.size - tagLength - 1 });
        await pipeline(readStream, decipher, res);

    } catch (err) {
        console.error("VAULT DOWNLOAD ERROR:", err);
        if (!res.headersSent) res.status(500).send("Download failed");
    }
};

// Get All Vaults for Logged User
exports.getUserVaults = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `SELECT id, name, description, created_at, expiry_date, share_token, download_count
       FROM vaults 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
            [userId]
        );

        res.json(result.rows);

    } catch (err) {
        console.error("GET USER VAULTS ERROR:", err);
        res.status(500).json({ error: "Failed to fetch vaults" });
    }
};

// Delete Vault
exports.deleteVault = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Verify vault belongs to user
        const vaultCheck = await pool.query("SELECT * FROM vaults WHERE id = $1 AND user_id = $2", [id, userId]);
        if (vaultCheck.rows.length === 0) {
            return res.status(404).json({ error: "Vault not found or unauthorized" });
        }

        // Delete associations first (if not cascading)
        await pool.query("DELETE FROM vault_files WHERE vault_id = $1", [id]);

        // Delete vault
        await pool.query("DELETE FROM vaults WHERE id = $1", [id]);

        res.json({ message: "Vault deleted successfully" });

    } catch (err) {
        console.error("DELETE VAULT ERROR:", err);
        res.status(500).json({ error: "Failed to delete vault" });
    }
};
