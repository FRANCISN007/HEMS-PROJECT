import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../api/authService";
import "./../../styles/AuthForm.css";
import { Link } from "react-router-dom";
import { getLicenseExpiryWarning } from "../../utils/licenseUtils";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const warning = getLicenseExpiryWarning();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const user = await loginUser(username.trim().toLowerCase(), password);
      localStorage.setItem("token", user.access_token);

      if (user.roles.includes("admin")) {
        navigate("/dashboard/users");
      } else if (user.roles.includes("dashboard")) {
        navigate("/dashboard/rooms/status");
      } else if (user.roles.includes("event")) {
        navigate("/dashboard/events");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err?.message || "Invalid username or password.");
    }
  };

  return (
    <div className="auth-page-wrapper">

      {/* ⭐ LEFT SIDE DESCRIPTION */}
      <div className="auth-left-panel">
        <h1 className="app-title">HEMS – Hotel & Event Management System</h1>
        <p className="app-description">
          HEMS 5-in-1 App is a comprehensive hospitality
          management solution designed to simplify and automate operations across:
        </p>

        <ul className="app-features">
          <li>Booking Management</li>
          <li>Bar Operations</li>
          <li>Restaurant Services</li>
          <li>Event Management</li>
          <li>Store & Inventory Control</li>
        </ul>

        <p className="app-tagline">
          Fast. Reliable. All-in-one hospitality control system.
        </p>
      </div>

      {/* ⭐ RIGHT SIDE LOGIN FORM */}
      <div className="auth-container">

        {warning && (
          <div className="license-warning">
            {warning}
          </div>
        )}

        <div className="auth-logo-text">
          H <span>E</span> M <span>S</span>
        </div>

        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="error">{error}</div>}

          <button type="submit">Login</button>

          <p>
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </form>
      </div>

      <footer className="homes-footer">
        <div>Produced & Licensed by School of Accounting Package</div>
        <div>© 2025</div>
      </footer>
    </div>
  );
};

export default LoginPage;
