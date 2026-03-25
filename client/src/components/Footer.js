import React from "react";
import "./Footer.css";

function Footer() {
    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-section">
                    <h3>SecureTransfer</h3>
                    <p>End-to-End Encrypted File Sharing</p>
                </div>
                <div className="footer-section">
                    <h4>Quick Links</h4>
                    <ul>
                        <li><a href="/dashboard">Dashboard</a></li>
                        <li><a href="/upload">Upload</a></li>
                        <li><a href="/settings">Settings</a></li>
                    </ul>
                </div>
                <div className="footer-section">
                    <h4>Security</h4>
                    <ul>
                        <li>AES-256-GCM</li>
                        <li>Zero-Knowledge</li>
                        <li>Self-Destructing Links</li>
                    </ul>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} SecureTransfer. All rights reserved.</p>
            </div>
        </footer>
    );
}

export default Footer;
