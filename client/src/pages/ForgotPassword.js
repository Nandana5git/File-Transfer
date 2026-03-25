import React, { useState } from "react";
import API from "../services/api";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");

        try {
            const res = await API.post("/auth/forgot-password", { email });
            setMessage(res.data.message);
            // In dev mode, if email isn't configured, we might show the link for convenience
            if (res.data.dev_link) {
                console.log("Dev Reset Link:", res.data.dev_link);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container animate-fade-in">
            <div className="auth-box animate-up" style={{ maxWidth: "420px", padding: "1.5rem 2rem" }}>
                <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Forgot Password</h2>
                <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>Enter your email and we'll send you a link to reset your password.</p>

                {message && <div className="p-2 mb-3 bg-success-light text-success border-success rounded small">{message}</div>}
                {error && <div className="p-2 mb-3 bg-error-light text-error border-error rounded small">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-block" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                    <div className="text-center mt-3">
                        <a href="/login" className="small text-primary">Back to Login</a>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ForgotPassword;
