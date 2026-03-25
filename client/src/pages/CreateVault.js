import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";

function CreateVault() {
    const location = useLocation();
    const navigate = useNavigate();
    const { selectedFileIds } = location.state || { selectedFileIds: [] };

    const [vaultName, setVaultName] = useState("");
    const [description, setDescription] = useState("");
    const [password, setPassword] = useState("");
    const [expiryDays, setExpiryDays] = useState(7);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [shareLink, setShareLink] = useState("");
    const [receiverEmail, setReceiverEmail] = useState("");

    const fetchFileDetails = useCallback(async () => {
        try {
            // We'll just fetch all files and filter them for now
            const res = await API.get("/uploads/my-files");
            const details = res.data.filter(f => selectedFileIds.includes(f.id));
            setSelectedFiles(details);
        } catch (err) {
            console.error(err);
            alert("Failed to load file details");
        } finally {
            setLoading(false);
        }
    }, [selectedFileIds]);

    useEffect(() => {
        if (selectedFileIds.length === 0) {
            navigate("/my-files");
            return;
        }
        fetchFileDetails();
    }, [selectedFileIds, fetchFileDetails, navigate]);

    const handleCreateVault = async () => {
        if (!vaultName) {
            alert("Please enter a name for the vault");
            return;
        }

        try {
            setCreating(true);
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));

            const res = await API.post("/vaults/create", {
                name: vaultName,
                description,
                password: password || null,
                expiryDate: expiryDate.toISOString(),
                fileIds: selectedFileIds,
                receiverEmail: receiverEmail || null
            });

            setShareLink(`${window.location.origin}/receive-vault/${res.data.shareToken}`);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || "Failed to create vault");
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div className="container text-center py-4">Loading file details...</div>;

    return (
        <div className="container animate-fade-in">
            <div className="card">
                <h2 className="mb-1">Create Secure Vault</h2>
                <p className="text-muted mb-2">Group {selectedFiles.length} files into a single secure link</p>

                {!shareLink ? (
                    <div className="settings-form animate-fade-in">
                        <div className="mb-2">
                            <label className="text-muted small">Vault Name</label>
                            <input
                                type="text"
                                placeholder="Enter vault name (e.g. Project Assets)"
                                value={vaultName}
                                onChange={(e) => setVaultName(e.target.value)}
                                className="mt-1"
                            />
                        </div>

                        <div className="mb-2">
                            <label className="text-muted small">Description (optional)</label>
                            <textarea
                                placeholder="What's inside this vault?"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", marginTop: "5px", minHeight: "80px" }}
                            />
                        </div>

                        <div className="upload-settings mb-2">
                            <div>
                                <label className="text-muted small">Vault Password</label>
                                <input
                                    type="password"
                                    placeholder="Set common password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-muted small">Expiry (Days)</label>
                                <select value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}>
                                    <option value="1">1 Day</option>
                                    <option value="7">7 Days</option>
                                    <option value="30">30 Days</option>
                                </select>
                            </div>
                        </div>

                        <div className="mb-2">
                            <label className="text-muted small">Receiver Emails (comma separated)</label>
                            <input
                                type="text"
                                placeholder="e.g. user1@example.com, user2@example.com"
                                value={receiverEmail}
                                onChange={(e) => setReceiverEmail(e.target.value)}
                                className="mt-1"
                            />
                        </div>

                        <div className="mb-2">
                            <label className="text-muted small">Included Files:</label>
                            <div className="mt-1" style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #eee", borderRadius: "8px", padding: "10px" }}>
                                {selectedFiles.map(file => (
                                    <div key={file.id} className="small mb-1" style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span>{file.display_name || file.original_name}</span>
                                        <span className="text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleCreateVault} className="btn w-100" disabled={creating}>
                            {creating ? "Creating Vault..." : "Generate Vault Link"}
                        </button>
                    </div>
                ) : (
                    <div className="share-section animate-up">
                        <div className="card" style={{ backgroundColor: "var(--bg-light)", border: "1px dashed var(--primary)" }}>
                            <p className="small mb-1 font-bold">Your vault is ready to share:</p>
                            <input
                                type="text"
                                readOnly
                                value={shareLink}
                                style={{ width: "100%", padding: "8px", borderRadius: "4px", fontSize: "0.8rem" }}
                            />
                            <button
                                className="nav-button mt-1 w-100"
                                onClick={() => {
                                    navigator.clipboard.writeText(shareLink);
                                    alert("Link copied!");
                                }}
                            >
                                Copy Vault Link
                            </button>
                        </div>
                        <button onClick={() => navigate("/my-files")} className="btn btn-outline w-100 mt-2">
                            Back to My Files
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CreateVault;
