import React from "react";
import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const isAuthenticated = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <nav className="navbar animate-fade-in">
      <div className="nav-left">
        <h2 className="logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          SecureShare
        </h2>
      </div>

      <div className="nav-right">
        <Link to="/" className="nav-link">Home</Link>

        {isAuthenticated && (
          <>
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            <Link to="/upload" className="nav-link">Upload</Link>
            <Link to="/my-files" className="nav-link">My Files</Link>
            <Link to="/my-vaults" className="nav-link">My Vaults</Link>

            <button className="nav-button" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}

        {!isAuthenticated && (
          <Link to="/login" className="nav-button">Login</Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
