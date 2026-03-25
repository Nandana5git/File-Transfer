import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await API.post("/auth/login", {
        email,
        password,
      });

      // Store real token
      localStorage.setItem("token", response.data.token);

      // Optional: store user info
      localStorage.setItem("user", JSON.stringify(response.data.user));

      navigate("/dashboard");

    } catch (err) {
      console.error(err);
      setError("Invalid email or password");
    }
  };

  return (
    <div className="container animate-fade-in">
      <div className="card">
        <h2>Welcome Back</h2>
        <p className="mb-1 text-muted">Please enter your details to login</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group mb-4">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group mb-4">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div style={{ textAlign: "right", marginTop: "4px" }}>
              <a href="/forgot-password" style={{ fontSize: "0.8rem", color: "var(--primary)" }}>Forgot Password?</a>
            </div>
          </div>

          <button type="submit" className="btn">
            Sign In
          </button>
        </form>

        {error && <p style={{ color: "var(--primary-dark)", marginTop: "10px", fontWeight: "600" }}>{error}</p>}

        <p className="mt-2 text-muted">
          Don’t have an account?{" "}
          <Link to="/register" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
