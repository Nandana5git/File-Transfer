import React, { useEffect, useState } from "react";
import API from "../services/api";
import "./Dashboard.css";
import { Link } from "react-router-dom";

function Dashboard() {
  const [stats, setStats] = useState({
    usedStorage: 0,
    totalStorage: 50 * 1024 * 1024 * 1024,
    totalFiles: 0,
    activeFiles: 0,
    expiredFiles: 0,
    lastUpload: null
  });
  const [recentFiles, setRecentFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [statsRes, filesRes] = await Promise.all([
        API.get("/uploads/stats"),
        API.get("/uploads/my-files")
      ]);
      setStats(statsRes.data);
      setRecentFiles(filesRes.data.slice(0, 5)); // Show last 5
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const timeAgo = (date) => {
    if (!date) return "Never";
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };

  const usedGB = (stats.usedStorage / 1024 / 1024 / 1024).toFixed(2);
  const totalGB = (stats.totalStorage / 1024 / 1024 / 1024).toFixed(0);
  const percentage = Math.min((stats.usedStorage / stats.totalStorage) * 100, 100);

  if (loading) return <div className="container" style={{ textAlign: "center", padding: "4rem" }}>Loading dashboard...</div>;

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="welcome-header">
        <h1>Welcome back!</h1>
        <p>Here's what's happening with your files today.</p>
      </div>

      <div className="stats-summary-grid">
        {/* Total Files Card */}
        <div className="stat-card animate-up">
          <div className="stat-icon-wrapper bg-blue-soft">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Files</div>
            <div className="stat-value">{stats.totalFiles}</div>
          </div>
        </div>

        {/* Storage Used Card */}
        <div className="stat-card animate-up" style={{ animationDelay: "0.1s" }}>
          <div className="stat-icon-wrapper bg-teal-soft">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Storage Used (Active)</div>
            <div className="stat-value">{formatSize(stats.usedStorage)} <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 400 }}>/ {totalGB} GB</span></div>
          </div>
        </div>

        {/* Files Shared Card */}
        <div className="stat-card animate-up" style={{ animationDelay: "0.2s" }}>
          <div className="stat-icon-wrapper bg-purple-soft">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Files Shared</div>
            <div className="stat-value">{stats.totalFiles}</div>
          </div>
        </div>

        {/* Last Upload Card */}
        <div className="stat-card animate-up" style={{ animationDelay: "0.3s" }}>
          <div className="stat-icon-wrapper bg-orange-soft">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Last Upload</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{timeAgo(stats.lastUpload)}</div>
          </div>
        </div>
      </div>

      <div className="storage-usage-section animate-up" style={{ animationDelay: "0.4s" }}>
        <div className="storage-header">
          <h3>Storage Usage</h3>
          <span className="storage-percentage">{percentage.toFixed(1)}%</span>
        </div>
        <p className="text-muted small mb-1">{formatSize(stats.usedStorage)} of {totalGB} GB used</p>
        <div className="storage-bar-container">
          <div className="storage-bar-fill" style={{ width: `${percentage}%` }}></div>
        </div>
      </div>

      <div className="quick-actions-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions-grid">
          <Link to="/upload" className="action-card animate-up" style={{ animationDelay: "0.5s" }}>
            <div className="action-icon-wrapper" style={{ background: '#e3f2fd', color: '#1976d2' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </div>
            <div className="action-details">
              <h4>Upload Files</h4>
              <p>Upload large files up to 10GB</p>
            </div>
          </Link>
          <Link to="/my-files" className="action-card animate-up" style={{ animationDelay: "0.6s" }}>
            <div className="action-icon-wrapper" style={{ background: '#e0f2f1', color: '#00796b' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div className="action-details">
              <h4>My Files</h4>
              <p>View and manage your files</p>
            </div>
          </Link>
          <Link to="/settings" className="action-card animate-up" style={{ animationDelay: "0.7s" }}>
            <div className="action-icon-wrapper" style={{ background: '#f3e5f5', color: '#7b1fa2' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div className="action-details">
              <h4>Security Settings</h4>
              <p>Manage your security preferences</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="recent-activity-section animate-up" style={{ animationDelay: "0.8s" }}>
        <div className="activity-header">
          <h2>Recent Activity</h2>
          <Link to="/my-files" className="view-all-link">View all →</Link>
        </div>
        <div className="activity-table-wrapper">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>File</th>
                <th>Size</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentFiles.length > 0 ? recentFiles.map((file, idx) => (
                <tr key={file.id}>
                  <td style={{ fontWeight: 500 }}>Uploaded</td>
                  <td>{file.original_name}</td>
                  <td>{formatSize(file.size)}</td>
                  <td>{timeAgo(file.upload_date)}</td>
                  <td><span className="status-badge status-completed">Completed</span></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No recent activity</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
