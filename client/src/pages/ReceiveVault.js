import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";

function ReceiveVault() {
    const { token } = useParams();
    const [vault, setVault] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [password, setPassword] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [vaultAccessToken, setVaultAccessToken] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [email, setEmail] = useState("");

    useEffect(() => {
        fetchVaultInfo();
    }, [token]);

    const fetchVaultInfo = async () => {
        try {
            const res = await API.get(`/vaults/share/${token}`);
            setVault(res.data);
            if (!res.data.password_required && !res.data.email_required) {
                // If no password and no email, we still need an access token
                handleVerify("", "");
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Vault not found or expired");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (providedPassword) => {
        try {
            setVerifying(true);
            const res = await API.post(`/vaults/share/verify/${token}`, {
                password: providedPassword !== undefined ? providedPassword : password,
                email: email || ""
            });
            setVaultAccessToken(res.data.vaultAccessToken);
            setIsVerified(true);
            setError("");
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Invalid password");
        } finally {
            setVerifying(false);
        }
    };

    const handleDownload = (fileId, fileName) => {
        // Standard browser download
        window.location.href = `${process.env.REACT_APP_API_URL}/api/vaults/share/download/${vaultAccessToken}/${fileId}`;
    };

    if (loading) return <div className="container text-center py-4">Opening secure vault...</div>;

    if (error && !vault) return <div className="container text-center py-4"><div className="card" style={{ borderColor: "#d32f2f" }}><h2 style={{ color: "#d32f2f" }}>Vault Error</h2><p>{error}</p></div></div>;

    return (
        <div className="container animate-fade-in">
            <div className="card">
                <h2 className="mb-1">{vault.name}</h2>
                <p className="text-muted mb-2">{vault.description || "Secure multi-file vault"}</p>

                {!isVerified ? (
                    <div className="animate-fade-in">
                        <div className="mb-2">
                            <label className="text-muted small">Vault Password</label>
                            <input
                                type="password"
                                placeholder="Enter password to open vault"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1"
                                disabled={!vault.password_required}
                            />
                        </div>
                        {vault.email_required && (
                            <div className="mb-2">
                                <label className="text-muted small">Verification Email</label>
                                <input
                                    type="email"
                                    placeholder="Enter your authorized email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="mt-1"
                                    required
                                />
                            </div>
                        )}
                        {error && <p className="small mb-2" style={{ color: "#d32f2f" }}>{error}</p>}
                        <button onClick={() => handleVerify()} className="btn w-100" disabled={verifying}>
                            {verifying ? "Opening..." : "Open Vault"}
                        </button>
                    </div>
                ) : (
                    <div className="animate-up">
                        <div className="file-list-vault mt-2">
                            <p className="small font-bold mb-1">Files in this vault:</p>
                            <div style={{ border: "1px solid #eee", borderRadius: "8px", overflow: "hidden" }}>
                                {vault.files.map(file => (
                                    <div key={file.id}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "12px",
                                            borderBottom: "1px solid #eee",
                                            backgroundColor: "#fff"
                                        }}>
                                        <div>
                                            <div className="font-bold small">{file.display_name || file.original_name}</div>
                                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                        </div>
                                        <button
                                            className="nav-button"
                                            style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                                            onClick={() => handleDownload(file.id, file.original_name)}
                                        >
                                            Download
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="mt-2 text-center text-muted small">
                            You can download each file individually from this secure vault.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ReceiveVault;
