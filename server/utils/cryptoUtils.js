const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Convert hex string to 32-byte buffer
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

// Safety checks
if (!process.env.ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY is not defined in .env");
}
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * (Keeping this for small data encryption if needed)
 */
exports.encryptBuffer = (buffer) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv, encryptedData: encrypted, authTag };
};

/**
 * Decrypts a buffer using AES-256-GCM.
 */
exports.decryptBuffer = (encryptedBuffer, iv, authTag) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
};

/**
 * Generates a SHA-256 hash of a file or buffer.
 */
exports.generateSHA256 = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

/**
 * Streaming AES-256-GCM Helpers
 */
exports.createCipherStream = (iv) => {
  return crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
};

exports.createDecipherStream = (iv, authTag) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher;
};

exports.getIVLength = () => IV_LENGTH;
exports.getAuthTagLength = () => AUTH_TAG_LENGTH;
