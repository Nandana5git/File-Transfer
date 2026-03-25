import React, { useEffect, useState } from "react";
import API from "../services/api";

function MyVaults() {
    const [vaults, setVaults] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("newest");

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

    const handleDelete = async (vaultId) => {
        if (!window.confirm("Are you sure you want to delete this vault? This action cannot be undone.")) {
            return;
        }

        try {
            await API.delete(`/vaults/${vaultId}`);
            setVaults(vaults.filter(v => v.id !== vaultId));
        } catch (error) {
            console.error("Delete error:", error);
            alert("Failed to delete vault. Please try again.");
        }
    };

    // Filter and Sort Logic
    const filteredAndSortedVaults = vaults
        .filter(vault => {
            const name = vault.name.toLowerCase();
            const desc = (vault.description || "").toLowerCase();
            return name.includes(searchTerm.toLowerCase()) || desc.includes(searchTerm.toLowerCase());
        })
        .sort((a, b) => {
            if (sortBy === "alphabetical_asc") {
                return a.name.localeCompare(b.name);
            }
            if (sortBy === "alphabetical_desc") {
                return b.name.localeCompare(a.name);
            }
            if (sortBy === "oldest") {
                return new Date(a.created_at) - new Date(b.created_at);
            }
            return new Date(b.created_at) - new Date(a.created_at); // Default: Newest
        });

    return (
        <div className="dashboard animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                    <h2 className="animate-up">My Secure Vaults</h2>
                    <p className="text-muted mb-1 animate-up">Manage your grouped files and shared vault links</p>
                </div>
            </div>

            <div className="animate-up" style={{ display: "flex", gap: "10px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "250px" }}>
                    <input
                        type="text"
                        placeholder="Search vaults..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "10px 15px",
                            borderRadius: "8px",
                            border: "1px solid #ddd",
                            fontSize: "0.9rem"
                        }}
                    />
                </div>
                <div style={{ minWidth: "180px" }}>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "8px",
                            border: "1px solid #ddd",
                            fontSize: "0.9rem",
                            backgroundColor: "#fff"
                        }}
                    >
                        <option value="newest">Recent Vaults</option>
                        <option value="oldest">Oldest Vaults</option>
                        <option value="alphabetical_asc">Alphabetical (A-Z)</option>
                        <option value="alphabetical_desc">Alphabetical (Z-A)</option>
                    </select>
                </div>
            </div>

            {filteredAndSortedVaults.length === 0 ? (
                <div className="stats-box text-center animate-up">
                    <p>{searchTerm ? "No vaults match your search." : "No vaults found. Select files in \"My Files\" to create your first vault!"}</p>
                </div>
            ) : (
                <div className="animate-up" style={{ overflowX: "auto" }}>
                    <table className="file-list">
                        <thead>
                            <tr style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "left" }}>
                                <th style={{ padding: "0 1.2rem 1rem" }}>Vault Name</th>
                                <th style={{ padding: "0 1.2rem 1rem" }}>Description</th>
                                <th style={{ padding: "0 1.2rem 1rem" }}>Created</th>
                                <th style={{ padding: "0 1.1rem 1rem" }}>Expires</th>
                                <th style={{ padding: "0 1.1rem 1rem" }}>Status</th>
                                <th style={{ padding: "0 1.1rem 1rem" }}>Downloads</th>
                                <th style={{ padding: "0 1.1rem 1rem" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedVaults.map((vault, index) => {
                                const isExpired = vault.expiry_date && new Date(vault.expiry_date) < new Date();

                                return (
                                    <tr key={vault.id} className="file-row" style={{ animationDelay: `${index * 0.05}s` }}>
                                        <td>
                                            <div style={{ fontWeight: "600", color: "var(--primary-dark)" }}>{vault.name}</div>
                                        </td>
                                        <td className="small text-muted">{vault.description || "-"}</td>
                                        <td>{formatDate(vault.created_at)}</td>
                                        <td>{formatDate(vault.expiry_date)}</td>
                                        <td>
                                            <span style={{
                                                padding: "4px 8px",
                                                borderRadius: "4px",
                                                fontSize: "0.75rem",
                                                fontWeight: "600",
                                                backgroundColor: isExpired ? "#ffebee" : "#e8f5e9",
                                                color: isExpired ? "#c62828" : "#2e7d32",
                                                border: `1px solid ${isExpired ? "#ef9a9a" : "#a5d6a7"}`
                                            }}>
                                                {isExpired ? "Expired" : "Active"}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <span style={{ fontWeight: "600" }}>{vault.download_count || 0}</span>
                                            </div>
                                        </td>
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
                                                <button
                                                    className="nav-button"
                                                    style={{
                                                        padding: "6px 12px",
                                                        fontSize: "0.8rem",
                                                        borderRadius: "6px",
                                                        backgroundColor: "#f44336",
                                                        borderColor: "#f44336"
                                                    }}
                                                    onClick={() => handleDelete(vault.id)}
                                                >
                                                    Delete
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
