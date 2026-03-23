import React, { useEffect, useState } from "react";
import API from "../services/api";

function MyVaults() {
    const [vaults, setVaults] = useState([]);

    useEffect(() => {
        fetchVaults();
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const fetchVaults = async () => {
        try {
            const res = await API.get("/vaults/my-vaults");
            setVaults(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="dashboard animate-fade-in">
            <h2 className="animate-up">My Secure Vaults</h2>
            <p className="text-muted mb-1 animate-up">Manage your grouped files and shared vault links</p>

            {vaults.length === 0 ? (
                <div className="stats-box text-center animate-up">
                    <p>No vaults found. Select files in "My Files" to create your first vault!</p>
                </div>
            ) : (
                <div className="animate-up" style={{ overflowX: "auto" }}>
                    <table className="file-list">
                        <thead>
                            <tr style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "left" }}>
                                <th style={{ padding: "0 1.2rem 1rem" }}>Vault Name</th>
                                <th style={{ padding: "0 1.2rem 1rem" }}>Description</th>
                                <th style={{ padding: "0 1.2rem 1rem" }}>Created</th>
                                <th style={{ padding: "0 1.2rem 1rem" }}>Expires</th>
                                <th style={{ padding: "0 1.2rem 1rem" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vaults.map((vault, index) => {
                                const isExpired = vault.expiry_date && new Date(vault.expiry_date) < new Date();

                                return (
                                    <tr key={vault.id} className="file-row" style={{ animationDelay: `${index * 0.05}s` }}>
                                        <td>
                                            <div style={{ fontWeight: "600", color: "var(--primary-dark)" }}>{vault.name}</div>
                                        </td>
                                        <td className="small text-muted">{vault.description || "-"}</td>
                                        <td>{formatDate(vault.created_at)}</td>
                                        <td style={{ color: isExpired ? "#d32f2f" : "inherit" }}>{formatDate(vault.expiry_date)}</td>
                                        <td>
                                            <div style={{ display: "flex", gap: "10px" }}>
                                                <button
                                                    className="nav-button"
                                                    style={{ padding: "6px 12px", fontSize: "0.8rem", borderRadius: "6px" }}
                                                    onClick={() => {
                                                        const link = `${window.location.origin}/receive-vault/${vault.share_token}`;
                                                        navigator.clipboard.writeText(link);
                                                        alert("Vault link copied!");
                                                    }}
                                                >
                                                    Copy Link
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default MyVaults;
