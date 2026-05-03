import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../../api/authService";
import "./LogReg.css";
import { getLicenseExpiryWarning } from "../../utils/licenseUtils";
import emailjs from "@emailjs/browser";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Inquiry modal states
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryData, setInquiryData] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    message: "",
  });
  const [inquirySending, setInquirySending] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState("");

  const warning = getLicenseExpiryWarning();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await loginUser(username.trim().toLowerCase(), password);
      localStorage.setItem("token", user.access_token);
      localStorage.setItem("user", JSON.stringify(user));

      if (user.roles?.some(role => 
        role.toLowerCase() === "admin" || role.toLowerCase() === "super_admin"
      )) {
        navigate("/dashboard/users");
      } else if (user.roles?.includes("dashboard")) {
        navigate("/dashboard/rooms/status");
      } else if (user.roles?.includes("event")) {
        navigate("/dashboard/events");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
      const backendMessage = err.response?.data?.detail || err.message;
      setError(backendMessage || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleInquiryChange = (e) => {
    setInquiryData({
      ...inquiryData,
      [e.target.name]: e.target.value,
    });
    if (inquiryError) setInquiryError("");
  };

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    setInquirySending(true);
    setInquiryError("");
    setInquirySuccess(false);

    try {
      await emailjs.send(
        "service_h1whxjl",
        "template_q87oeec",
        {
          from_name: inquiryData.name,
          business_name: inquiryData.business || "Not provided",
          reply_to: inquiryData.email,
          phone: inquiryData.phone || "Not provided",
          message: inquiryData.message,
          // Removed to_email - it must be set in the EmailJS template
        },
        "lsob-mW-ooAUT74xr"
      );

      setInquirySuccess(true);

      setTimeout(() => {
        setShowInquiry(false);
        setInquirySuccess(false);
        setInquiryData({ name: "", business: "", email: "", phone: "", message: "" });
      }, 2500);
    } catch (err) {
      console.error("EmailJS Error:", err);
      const errorMsg = err.text || err.message || "Unknown error";
      setInquiryError(`Failed to send: ${errorMsg}`);
    } finally {
      setInquirySending(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* LEFT SIDE - HEMS Branding */}
      
      <div className="top-left-brand">
          <div className="logo-orbit-wrapper">
            <img src="/images/hems-logo.jpeg" className="top-left-logo" />
            <span className="orbit-ring"></span>
            <span className="orbit-dot"></span>
          </div>
        </div>

      {/* RIGHT SIDE - Login + Inquiry Link */}
      <div className="auth-container">
        {warning && <div className="license-warning">{warning}</div>}

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
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && <div className="error">{error}</div>}

          <button 
            type="submit" 
            className="login-btn" 
            disabled={loading}
          >
            {loading ? <span className="spinner"></span> : "Login"}
          </button>
        </form>

        <p className="inquiry-link">
          Interested in HEMS for your hotel?{" "}
          <button 
            type="button" 
            className="text-link" 
            onClick={() => setShowInquiry(true)}
          >
            Send Inquiry
          </button>
        </p>
      </div>

      <footer className="homes-footer">
        <div>Produced & Licensed by School of Accounting Package</div>
        <div>© 2026</div>
      </footer>

      {/* INQUIRY MODAL */}
      {showInquiry && (
        <div className="modal-overlay">
          <div className="modal-content inquiry-modal">
            <button className="close-btn" onClick={() => setShowInquiry(false)}>✖</button>
            
            <h3>Request Access / Inquiry</h3>
            <p className="modal-subtitle">
              Tell us about your hotel or requirements. We'll get back to you shortly.
            </p>

            {inquirySuccess ? (
              <div className="success-message">
                ✅ Inquiry sent successfully!<br />
                Thank you. We will contact you soon.
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit}>
                <input
                  type="text"
                  name="name"
                  placeholder="Your Full Name *"
                  value={inquiryData.name}
                  onChange={handleInquiryChange}
                  required
                />
                <input
                  type="text"
                  name="business"
                  placeholder="Hotel / Business Name *"
                  value={inquiryData.business}
                  onChange={handleInquiryChange}
                  required
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Your Email Address *"
                  value={inquiryData.email}
                  onChange={handleInquiryChange}
                  required
                />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number (optional)"
                  value={inquiryData.phone}
                  onChange={handleInquiryChange}
                />
                <textarea
                  name="message"
                  placeholder="Your requirements or message *"
                  rows="4"
                  value={inquiryData.message}
                  onChange={handleInquiryChange}
                  required
                />

                {inquiryError && <div className="error">{inquiryError}</div>}

                <button 
                  type="submit" 
                  className="login-btn"
                  disabled={inquirySending}
                >
                  {inquirySending ? "Sending..." : "Send Inquiry"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;