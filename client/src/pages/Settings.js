import React, { useState, useEffect } from "react";
import API from "../services/api";

const isStrongPassword = (password) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
};

function Settings() {
    const [profile, setProfile] = useState({ name: "", email: "" });
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ type: "", message: "" });
    const [passStatus, setPassStatus] = useState({ type: "", message: "" });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await API.get("/auth/profile");
            setProfile({ name: res.data.name, email: res.data.email });
        } catch (err) {
            console.error("Failed to fetch profile", err);
            setStatus({ type: "error", message: "Failed to load profile information" });
        } finally {
            setLoading(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setStatus({ type: "", message: "" });
        try {
            const res = await API.put("/auth/profile", profile);
            setStatus({ type: "success", message: res.data.message });
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to update profile";
            setStatus({ type: "error", message: msg });
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPassStatus({ type: "", message: "" });

        if (!isStrongPassword(passwordData.newPassword)) {
            return setPassStatus({
                type: "error",
                message: "New password must be at least 8 characters long, include a capital letter, a number, and a special character."
            });
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return setPassStatus({ type: "error", message: "New passwords do not match" });
        }

        try {
            const res = await API.put("/auth/change-password", {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            setPassStatus({ type: "success", message: res.data.message });
            setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to change password";
            setPassStatus({ type: "error", message: msg });
        }
    };

    if (loading) return <div className="container" style={{ textAlign: "center", padding: "4rem" }}>Loading settings...</div>;

    return (
        <div className="settings-container animate-fade-in">
            <div className="settings-header">
                <h1>Security Settings</h1>
                <p>Manage your account security and profile information.</p>
            </div>

            {/* Profile Section */}
            <div className="settings-section animate-up">
                <h2>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-teal"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Profile Information
                </h2>

                {status.message && (
                    <div className={`status-message status-${status.type}`}>
                        {status.message}
                    </div>
                )}

                <form onSubmit={handleProfileUpdate}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            required
                        />
                    </div>
                    <button type="submit" className="settings-btn">Update Profile</button>
                </form>
            </div>

            {/* Password Section */}
            <div className="settings-section animate-up" style={{ animationDelay: "0.1s" }}>
                <h2>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-blue"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    Change Password
                </h2>

                {passStatus.message && (
                    <div className={`status-message status-${passStatus.type}`}>
                        {passStatus.message}
                    </div>
                )}

                <form onSubmit={handlePasswordChange}>
                    <div className="form-group">
                        <label>Current Password</label>
                        <input
                            type="password"
                            placeholder="Enter current password"
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>New Password</label>
                        <input
                            type="password"
                            placeholder="Enter new password"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirm New Password</label>
                        <input
                            type="password"
                            placeholder="Confirm new password"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            required
                        />
                    </div>
                    <button type="submit" className="settings-btn">Change Password</button>
                </form>
            </div>
        </div>
    );
}

export default Settings;
