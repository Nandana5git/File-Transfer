import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";

const isStrongPassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isStrongPassword(password)) {
      return setMessage("Password must be at least 8 characters long, include a capital letter, a number, and a special character.");
    }

    try {
      await API.post("/auth/register", {
        name,
        email,
        password,
      });

      setMessage("Registration successful! Please login.");
      setTimeout(() => navigate("/login"), 1500);

    } catch (err) {
      console.error(err);
      setMessage("Registration failed");
    }
  };

  return (
    <div className="container animate-fade-in">
      <div className="card">
        <h2>Create Account</h2>
        <p className="mb-1 text-muted">Join SecureShare today</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Full Name"
            onChange={(e) => setName(e.target.value)}
            required
          />

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
            Create Account
          </button>
        </form>

        {message && (
          <p style={{ marginTop: "10px", color: "var(--primary)", fontWeight: "600" }}>
            {message}
          </p>
        )}

        <p className="mt-2 text-muted">
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
