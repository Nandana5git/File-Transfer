const pool = require("../models/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const isStrongPassword = (password) => {
  // Min 8 characters, at least one uppercase letter, one lowercase letter, one number and one special character
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};

// REGISTER USER
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const userCheck = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Check password strength
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long, include a capital letter, a number, and a special character."
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: newUser.rows[0],
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};


// LOGIN USER
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare password
    const validPassword = await bcrypt.compare(
      password,
      user.rows[0].password
    );

    if (!validPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.rows[0].id,
        name: user.rows[0].name,
        email: user.rows[0].email
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};
// GET PROFILE
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, email } = req.body;

    const updatedUser = await pool.query(
      "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email",
      [name, email, userId]
    );

    res.json({
      message: "Profile updated successfully",
      user: updatedUser.rows[0],
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(
      currentPassword,
      user.rows[0].password
    );

    if (!validPassword) {
      return res.status(400).json({ message: "Invalid current password" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: "New password must be at least 8 characters long, include a capital letter, a number, and a special character."
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      userId,
    ]);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await pool.query("SELECT id, name FROM users WHERE email = $1", [email]);

    if (user.rows.length === 0) {
      // Logically we shouldn't reveal if a user exists, but for UX simple apps usually do
      return res.status(404).json({ message: "User with this email does not exist" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3600000); // 1 hour from now

    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3",
      [token, expiry, email]
    );

    const resetLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password/${token}`;

    const msg = {
      to: email,
      from: process.env.EMAIL_FROM || "noreply@securetransfer.com", // Verified sender in SendGrid
      subject: "Password Reset Request - SecureTransfer",
      text: `Hello ${user.rows[0].name},\n\nYou requested a password reset. Click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\n\nBest,\nSecureTransfer Team`,
      html: `<h3>Hello ${user.rows[0].name},</h3>
                   <p>You requested a password reset. Click the link below to reset your password:</p>
                   <p><a href="${resetLink}">${resetLink}</a></p>
                   <p>This link will expire in 1 hour.</p>
                   <p>If you did not request this, please ignore this email.</p>
                   <p>Best,<br>SecureTransfer Team</p>`,
    };

    if (process.env.SENDGRID_API_KEY) {
      try {
        await sgMail.send(msg);
        res.json({ message: "Password reset link sent to your email" });
      } catch (sgErr) {
        console.error("SENDGRID SEND ERROR:", sgErr);
        let errorMessage = "Failed to send email. Please check your SendGrid configuration.";
        if (sgErr.response && sgErr.response.body && sgErr.response.body.errors) {
          errorMessage = sgErr.response.body.errors.map(e => e.message).join(". ");
        }
        res.status(500).json({ message: errorMessage });
      }
    } else {
      console.log("SENDGRID_API_KEY is missing. Reset Link:", resetLink);
      res.json({
        message: "Email service is not configured, but a reset link has been generated (check server logs in dev)",
        dev_link: resetLink
      });
    }

  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await pool.query(
      "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()",
      [token]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long, include a capital letter, a number, and a special character."
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2",
      [hashedPassword, user.rows[0].id]
    );

    res.json({ message: "Password reset successfully. You can now login with your new password." });

  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// DELETE ACCOUNT
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const path = require("path");
    const fs = require("fs");

    // 1. Fetch all user files to delete from disk
    const filesResult = await pool.query("SELECT filename FROM files WHERE user_id = $1 AND filename IS NOT NULL", [userId]);
    const UPLOADS_DIR = path.join(__dirname, "../uploads");

    for (const file of filesResult.rows) {
      const filePath = path.join(UPLOADS_DIR, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // 2. Delete data in order of dependency
    // Delete vault_files first
    await pool.query("DELETE FROM vault_files WHERE vault_id IN (SELECT id FROM vaults WHERE user_id = $1)", [userId]);

    // Delete vaults
    await pool.query("DELETE FROM vaults WHERE user_id = $1", [userId]);

    // Delete upload_sessions
    await pool.query("DELETE FROM upload_sessions WHERE user_id = $1", [userId]);

    // Delete files
    await pool.query("DELETE FROM files WHERE user_id = $1", [userId]);

    // 3. Finally, delete the user
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    res.json({ message: "Account and all associated data deleted successfully" });

  } catch (err) {
    console.error("DELETE ACCOUNT ERROR:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
};
