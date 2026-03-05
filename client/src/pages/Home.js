import React from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div className="hero animate-up">
        <h1>Secure File Transfer <br /> <span style={{ color: "var(--primary)" }}>Made Simple</span></h1>
        <p>
          Share large files securely with enterprise-grade encryption,
          expiry control, and download limits.
        </p>

        <button className="hero-btn" onClick={() => navigate("/login")}>
          Start Sharing Free
        </button>
      </div>

      {/* Features Section */}
      <div className="features">
        <h2 className="animate-up">Why choose SecureShare?</h2>

        <div className="feature-grid">
          <div className="feature-card animate-up" style={{ animationDelay: "0.1s" }}>
            <h3>🔐 AES Encryption</h3>
            <p>Files are encrypted before storage for maximum security. Your privacy is our priority.</p>
          </div>

          <div className="feature-card animate-up" style={{ animationDelay: "0.2s" }}>
            <h3>📦 Chunk Upload</h3>
            <p>Upload large files smoothly using chunk-based uploading. No more interrupted uploads.</p>
          </div>

          <div className="feature-card animate-up" style={{ animationDelay: "0.3s" }}>
            <h3>⏳ Expiry Control</h3>
            <p>Set expiry dates to auto-delete files after time limit. Maintain control over your data.</p>
          </div>

          <div className="feature-card animate-up" style={{ animationDelay: "0.4s" }}>
            <h3>🔢 Download Limit</h3>
            <p>Control exactly how many times a file can be downloaded before it expires.</p>
          </div>

          <div className="feature-card animate-up" style={{ animationDelay: "0.5s" }}>
            <h3>📧 Email Protection</h3>
            <p>Add an extra layer of security by requiring email verification for downloads.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
