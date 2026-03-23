import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function MyFiles() {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
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

  const toggleFileSelection = (fileId) => {
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

  return (
    <div className="dashboard animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="animate-up">My Secured Files</h2>
          <p className="text-muted mb-1 animate-up">Manage your encrypted uploads and track activity</p>
        </div>
        <button
          className="btn animate-up"
          onClick={handleCreateVault}
          disabled={selectedFiles.length === 0}
          style={{
            padding: "4px 12px",
            fontSize: "0.75rem",
            borderRadius: "50px",
            width: "fit-content",
            whiteSpace: "nowrap"
          }}
        >
          + Vault ({selectedFiles.length})
        </button>
      </div>

      {files.length === 0 ? (
        <div className="stats-box text-center animate-up">
          <p>No files found. Start by uploading something secure!</p>
        </div>
      ) : (
        <div className="animate-up" style={{ overflowX: "auto" }}>
          <table className="file-list">
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "left" }}>
                <th style={{ padding: "0 1.2rem 1rem" }}>
                  <input
                    type="checkbox"
                    onChange={(e) => setSelectedFiles(e.target.checked ? files.map(f => f.id) : [])}
                    checked={selectedFiles.length === files.length && files.length > 0}
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
              {files.map((file, index) => {
                const isExpired = file.expiry_date && new Date(file.expiry_date) < new Date();
                const limitReached = file.max_downloads && file.download_count >= file.max_downloads;
                const status = isExpired ? "Expired" : (limitReached ? "Limit Reached" : "Active");
                const statusColor = status === "Active" ? "var(--primary)" : "#d32f2f";

                return (
                  <tr key={file.id} className="file-row" style={{ animationDelay: `${index * 0.05}s` }}>
                    <td style={{ padding: "1.2rem" }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: "600", color: "var(--primary-dark)" }}>
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
                      <div className="small text-muted" style={{ fontSize: "0.7rem", fontFamily: "monospace" }}>{file.checksum?.substring(0, 12)}...</div>
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
