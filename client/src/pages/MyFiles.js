import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function MyFiles() {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const navigate = useNavigate();

  useEffect(() => {
    fetchFiles();
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

  const fetchFiles = async () => {
    try {
      const res = await API.get("/uploads/my-files");
      setFiles(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleFileSelection = (fileId, isExpired) => {
    if (isExpired) return;
    setSelectedFiles(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const handleCreateVault = () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file to create a vault.");
      return;
    }
    // Pass selected file IDs to the create vault page
    navigate("/create-vault", { state: { selectedFileIds: selectedFiles } });
  };

  // Filter and Sort Logic
  const filteredAndSortedFiles = files
    .filter(file => {
      const name = (file.display_name || file.original_name).toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === "alphabetical_asc") {
        return (a.display_name || a.original_name).localeCompare(b.display_name || b.original_name);
      }
      if (sortBy === "alphabetical_desc") {
        return (b.display_name || b.original_name).localeCompare(a.display_name || a.original_name);
      }
      if (sortBy === "oldest") {
        return new Date(a.upload_date) - new Date(b.upload_date);
      }
      return new Date(b.upload_date) - new Date(a.upload_date); // Default: Newest
    });

  return (
    <div className="dashboard animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h2 className="animate-up">My Secured Files</h2>
          <p className="text-muted mb-1 animate-up">Manage your encrypted uploads and track activity</p>
        </div>
        <button
          className="btn animate-up"
          onClick={handleCreateVault}
          disabled={selectedFiles.length === 0}
          style={{
            padding: "8px 16px",
            fontSize: "0.85rem",
            borderRadius: "50px",
            width: "fit-content",
            whiteSpace: "nowrap"
          }}
        >
          + Vault ({selectedFiles.length})
        </button>
      </div>

      <div className="animate-up" style={{ display: "flex", gap: "10px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
          <input
            type="text"
            placeholder="Search by filename..."
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
            <option value="newest">Recent Uploads</option>
            <option value="oldest">Oldest Uploads</option>
            <option value="alphabetical_asc">Alphabetical (A-Z)</option>
            <option value="alphabetical_desc">Alphabetical (Z-A)</option>
          </select>
        </div>
      </div>

      {filteredAndSortedFiles.length === 0 ? (
        <div className="stats-box text-center animate-up">
          <p>{searchTerm ? "No files match your search." : "No files found. Start by uploading something secure!"}</p>
        </div>
      ) : (
        <div className="animate-up" style={{ overflowX: "auto" }}>
          <table className="file-list">
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "left" }}>
                <th style={{ padding: "0 1.2rem 1rem" }}>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      const selectableIds = filteredAndSortedFiles
                        .filter(f => !(f.expiry_date && new Date(f.expiry_date) < new Date()))
                        .map(f => f.id);
                      setSelectedFiles(e.target.checked ? selectableIds : []);
                    }}
                    checked={selectedFiles.length > 0 && selectedFiles.length === filteredAndSortedFiles.filter(f => !(f.expiry_date && new Date(f.expiry_date) < new Date())).length}
                  />
                </th>
                <th style={{ padding: "0 1.2rem 1rem" }}>File Name</th>
                <th style={{ padding: "0 1.2rem 1rem" }}>Size</th>
                <th style={{ padding: "0 1.2rem 1rem" }}>Uploaded</th>
                <th style={{ padding: "0 1.2rem 1rem" }}>Expires</th>
                <th style={{ padding: "0 1.2rem 1rem" }}>Status</th>
                <th style={{ padding: "0 1.2rem 1rem" }}>Downloads</th>
                <th style={{ padding: "0 1.2rem 1rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedFiles.map((file, index) => {
                const isExpired = file.expiry_date && new Date(file.expiry_date) < new Date();
                const limitReached = file.max_downloads && file.download_count >= file.max_downloads;
                const status = isExpired ? "Expired" : (limitReached ? "Limit Reached" : "Active");
                const statusColor = status === "Active" ? "var(--primary)" : "#d32f2f";

                return (
                  <tr
                    key={file.id}
                    className="file-row"
                    style={{
                      animationDelay: `${index * 0.05}s`,
                      opacity: isExpired ? 0.7 : 1
                    }}
                  >
                    <td style={{ padding: "1.2rem" }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => toggleFileSelection(file.id, isExpired)}
                        disabled={isExpired}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: "600", color: isExpired ? "var(--text-muted)" : "var(--primary-dark)" }}>
                        {file.display_name || file.original_name}
                      </div>
                      {file.display_name && (
                        <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                          Original: {file.original_name}
                        </div>
                      )}
                      {file.description && (
                        <div className="small text-muted" style={{ fontSize: "0.75rem", marginBottom: "4px" }}>{file.description}</div>
                      )}
                      {!isExpired && <div className="small text-muted" style={{ fontSize: "0.7rem", fontFamily: "monospace" }}>{file.checksum?.substring(0, 12)}...</div>}
                    </td>
                    <td>{(file.size / 1024 / 1024).toFixed(2)} MB</td>
                    <td>{formatDate(file.upload_date)}</td>
                    <td style={{ color: isExpired ? "#d32f2f" : "inherit" }}>{formatDate(file.expiry_date)}</td>
                    <td>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        backgroundColor: status === "Active" ? "rgba(46, 125, 50, 0.1)" : "rgba(211, 47, 47, 0.1)",
                        color: statusColor
                      }}>
                        {status}
                      </span>
                    </td>
                    <td className="small">
                      {file.download_count} / {file.max_downloads || "∞"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "10px" }}>
                        {!isExpired && (
                          <button
                            className="nav-button"
                            style={{ padding: "6px 12px", fontSize: "0.8rem", borderRadius: "6px" }}
                            onClick={() => {
                              const link = `${window.location.origin}/receive/${file.share_token}`;
                              navigator.clipboard.writeText(link);
                              alert("Link copied!");
                            }}
                          >
                            Copy Link
                          </button>
                        )}
                        <button
                          className="nav-button"
                          style={{
                            padding: "6px 12px",
                            fontSize: "0.8rem",
                            borderRadius: "6px",
                            backgroundColor: "#fff",
                            color: "#d32f2f",
                            borderColor: "#ffcdd2",
                          }}
                          onClick={async () => {
                            if (!window.confirm("Are you sure you want to delete this file?")) return;
                            try {
                              await API.delete(`/uploads/delete/${file.id}`);
                              fetchFiles();
                              // Clear selection if deleted
                              setSelectedFiles(prev => prev.filter(id => id !== file.id));
                            } catch (err) {
                              console.error(err);
                              alert("Delete failed");
                            }
                          }}
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

export default MyFiles;
