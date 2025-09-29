import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { verifyLicense, generateLicense } from "../../api/licenseApi";
import "./LicensePage.css";

const LicensePage = () => {
  const [licenseKey, setLicenseKey] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Reset inputs & messages every time the route changes to /license
  useEffect(() => {
    if (location.pathname === "/license") {
      setLicenseKey("");
      setPassword("");
      setMessage("");
      setError("");
    }
  }, [location]);

  // ✅ Verify license
  const handleVerify = async () => {
    setMessage("");
    setError("");

    if (!licenseKey) {
      setError("Please enter a license key.");
      return;
    }

    try {
      const data = await verifyLicense(licenseKey); // { valid, expires_on }

      if (data.valid) {
        let expiryMsg = "";
        if (data.expires_on) {
          const expiryDate = new Date(data.expires_on);
          expiryMsg = ` (valid until ${expiryDate.toLocaleDateString()})`;
          localStorage.setItem("license_valid_until", data.expires_on);
        }

        setMessage(`License verified successfully${expiryMsg}.`);
        localStorage.setItem("license_verified", "true");

        setLicenseKey("");
        setPassword("");

        if (typeof setIsLicenseVerified === "function") {
          setIsLicenseVerified(true);
        }

        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(data.message || "Verification failed.");
      }
    } catch (err) {
      setError(err.message || "Verification failed.");
    }
  };

  // ✅ Generate license
  const handleGenerate = async () => {
    setMessage("");
    setError("");

    if (!password || !licenseKey) {
      setError("Please enter both admin password and license key.");
      return;
    }

    try {
      const data = await generateLicense(password, licenseKey);
      setMessage(
        data.key ? `License generated: ${data.key}` : "License generated."
      );
      setLicenseKey("");
      setPassword("");
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || "";

      if (status === 400) {
        if (detail.toLowerCase().includes("already exists")) {
          setError("This license key is already in use.");
        } else {
          setError(detail || "Invalid request.");
        }
      } else if (status === 403) {
        setError("Invalid admin password.");
      } else if (status === 409) {
        setError("This license key already exists.");
      } else {
        setError("License generation failed. Please try again.");
      }
    }
  };

  return (
    <>
      <div className="hems-logo">H&nbsp;E&nbsp;M&nbsp; S</div>
      <div className="hems-subtitle">Hotel & Event Management System</div>

      <div className="license-container">
        <h2 className="license-title">License Management</h2>

        <div className="license-form-group">
          <label className="license-label">License Key:</label>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Enter license key"
            className="license-input"
          />
        </div>

        <div className="license-form-group">
          <label className="license-label">Admin Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="license-input"
          />
        </div>

        <div className="license-button-group">
          <button className="license-button" onClick={handleVerify}>
            Verify License
          </button>
          <button className="license-button" onClick={handleGenerate}>
            Generate License
          </button>
        </div>

        {/* ✅ Messages */}
        {message && <p className="license-message success">{message}</p>}
        {error && <p className="license-message error">{error}</p>}
      </div>
    </>
  );
};

export default LicensePage;
