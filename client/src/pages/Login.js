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
          <input
            type="email"
            placeholder="Email Address"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

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
