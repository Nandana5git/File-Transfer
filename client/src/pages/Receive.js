import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";

function Receive() {
    const { token } = useParams();
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        fetchFileInfo();
    }, [token]);

    const fetchFileInfo = async () => {
        try {
            const res = await API.get(`/uploads/share/${token}`);
            setFile(res.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Invalid or expired link");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            if (file.email_required && !email) {
                setError("Please provide your email to access this file");
                return;
            }

            setDownloading(true);
            setError("");

            // 1. Verify credentials and get a temporary stream token
            const verifyRes = await API.post(`/uploads/share/verify/${token}`, {
                password,
                email
            });

            const { streamToken } = verifyRes.data;

            // 2. Use window.location.href to trigger a native browser download
            // This bypasses blob buffering and works for any file size
            window.location.href = `http://localhost:5000/api/uploads/share/stream/${streamToken}`;

            // Small delay to reset UI
            setTimeout(() => {
                setDownloading(false);
            }, 3000);

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || err.message || "Download failed");
            setDownloading(false);
        }
    };

    if (loading) return <div className="container text-center py-4">Checking link security...</div>;

    if (error && !file) return <div className="container text-center py-4"><div className="card" style={{ borderColor: "#d32f2f" }}><h2 style={{ color: "#d32f2f" }}>Link Error</h2><p>{error}</p></div></div>;

    return (
        <div className="container animate-fade-in">
            <div className="card">
                <h2 className="mb-1">Secure Download</h2>
                <p className="text-muted mb-2">You have been sent a secure encrypted file</p>

                <div className="file-info-box p-2 mb-2" style={{ backgroundColor: "var(--bg-light)", borderRadius: "8px" }}>
                    <div className="font-bold mb-1" style={{ color: "var(--primary-dark)" }}>{file.original_name}</div>
                    <div className="small text-muted">Size: {(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    {file.expiry_date && (
                        <div className="small text-muted">Expires: {new Date(file.expiry_date).toLocaleString()}</div>
                    )}
                </div>

                {file.email_required && (
                    <div className="mb-2">
                        <label className="text-muted small">Verification Email</label>
                        <input
                            type="email"
                            placeholder="Enter your email to verify"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                )}

                {file.password_required && (
                    <div className="mb-2">
                        <label className="text-muted small">Enter Password</label>
                        <input
                            type="password"
                            placeholder="This file is password protected"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                )}

                {error && (
                    <p className="mb-2 small" style={{ color: "#d32f2f" }}>{error}</p>
                )}

                <button
                    onClick={handleDownload}
                    className="btn w-100"
                    disabled={downloading}
                >
                    {downloading ? "Decrypting & Downloading..." : "Start Secure Download"}
                </button>

                <p className="mt-2 text-center text-muted small">
                    Decryption happens in real-time. Do not close this tab.
                </p>
            </div>
        </div>
    );
}

export default Receive;
