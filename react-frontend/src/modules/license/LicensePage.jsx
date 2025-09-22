import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { verifyLicense, generateLicense } from "../../api/licenseApi";
import { updateApp } from "../../api/systemApi"; // ✅ import new API
import "./LicensePage.css";

const LicensePage = () => {
  const [licenseKey, setLicenseKey] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rebuildMessage, setRebuildMessage] = useState("");
  const [isRebuilding, setIsRebuilding] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Reset inputs & messages every time the route changes to /license
  useEffect(() => {
    if (location.pathname === "/license") {
      setLicenseKey("");
      setPassword("");
      setMessage("");
      setError("");
      setRebuildMessage("");
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

  // ✅ Trigger rebuild
  const handleUpdateApp = async () => {
    setRebuildMessage("Updating app... please wait");
    setIsRebuilding(true);

    try {
      const data = await updateApp();
      if (data.status === "success") {
        setRebuildMessage("✅ Update successful! You can now verify your license.");
      } else {
        setRebuildMessage("❌ Update failed. Try again.");
      }
    } catch (err) {
      setRebuildMessage(
        "❌ Error during update: " + (err.response?.data?.detail || err.message)
      );
    } finally {
      setIsRebuilding(false);
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
      {/* ✅ Update App Button (top-right corner) */}
      <div style={{ position: "absolute", top: "15px", right: "20px" }}>
        <button
          onClick={handleUpdateApp}
          disabled={isRebuilding}
          style={{
            padding: "8px 12px",
            backgroundColor: isRebuilding ? "#6c757d" : "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: isRebuilding ? "not-allowed" : "pointer",
          }}
        >
          {isRebuilding ? "Updating..." : "Update App"}
        </button>
      </div>

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
            disabled={isRebuilding}
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
            disabled={isRebuilding}
          />
        </div>

        <div className="license-button-group">
          <button
            className="license-button"
            onClick={handleVerify}
            disabled={isRebuilding}
          >
            Verify License
          </button>
          <button
            className="license-button"
            onClick={handleGenerate}
            disabled={isRebuilding}
          >
            Generate License
          </button>
        </div>

        {/* ✅ Messages */}
        {message && <p className="license-message success">{message}</p>}
        {error && <p className="license-message error">{error}</p>}
        {rebuildMessage && (
          <p
            className={`license-message ${
              rebuildMessage.startsWith("✅")
                ? "success"
                : rebuildMessage.startsWith("❌")
                ? "error"
                : ""
            }`}
          >
            {isRebuilding && <span className="emoji-spinner">⏳</span>}{" "}
            {rebuildMessage}
          </p>
        )}
      </div>
    </>
  );
};

export default LicensePage;
