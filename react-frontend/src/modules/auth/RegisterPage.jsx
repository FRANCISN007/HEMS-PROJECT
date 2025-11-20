import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../../api/authService";
import "./LogReg.css";

const roleOptions = ["user", "admin", "dashboard", "bar", "restaurant", "store", "event"];

const RegisterPage = () => {
  const [form, setForm] = useState({
    username: "",
    password: "",
    roles: ["user"],
    admin_password: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, checked } = e.target;

    if (name === "roles") {
      setForm((prev) => {
        let newRoles = [...prev.roles];
        if (checked) {
          if (!newRoles.includes(value)) newRoles.push(value);
        } else {
          newRoles = newRoles.filter((r) => r !== value);
        }
        return { ...prev, roles: newRoles };
      });
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!form.admin_password) {
      setError("Admin password is required for registration.");
      return;
    }

    try {
      await registerUser(form);
      alert("Registration successful!");
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Registration failed.");
    }
  };

  return (
    <div className="auth-page-wrapper">

      {/* ⭐ SAME LEFT PANEL AS LOGIN ⭐ */}
      <div className="auth-left-panel">
        <h1 className="app-title">
          HEMS – Hotel & Event Management System
        </h1>

        <p className="app-description">
          HEMS 5-in-1 App is a complete hospitality management solution designed to
          simplify, automate, and centralize operations across:
        </p>

        <ul className="app-features">
          <li>Booking Management</li>
          <li>Bar Operations</li>
          <li>Restaurant Services</li>
          <li>Event Management</li>
          <li>Store & Inventory Control</li>
        </ul>

        <p className="app-tagline">
          Fast • Reliable • All-in-One Hospitality Control
        </p>
      </div>

      {/* ⭐ RIGHT SIDE REGISTER FORM ⭐ */}
      <div className="auth-container">
        <div className="auth-logo-text">
          H <span>E</span> M <span>S</span>
        </div>

        <h2>Register</h2>

        {error && <p className="error-msg">{error}</p>}

        <form onSubmit={handleRegister}>
          <input
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />

          {/* Roles */}
          <div className="roles-selection">
            {roleOptions.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  name="roles"
                  value={role}
                  checked={form.roles.includes(role)}
                  onChange={handleChange}
                />
                {role === "dashboard"
                  ? "Hotel (Dashboard)"
                  : role.charAt(0).toUpperCase() + role.slice(1)}
              </label>
            ))}
          </div>

          {/* Admin Password */}
          <input
            name="admin_password"
            type="password"
            placeholder="Admin Password"
            value={form.admin_password}
            onChange={handleChange}
            required
          />

          <button type="submit">Register</button>
        </form>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>

    </div>
  );
};

export default RegisterPage;
