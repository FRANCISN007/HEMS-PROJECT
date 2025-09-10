import React from "react";
import { useNavigate } from "react-router-dom";
import { checkLicenseStatus } from "../api/licenseApi";
import backgroundImage from "../assets/images/hotel-bg.jpg";
import "./HomePage.css";

const HomePage = () => {
  const navigate = useNavigate();

  const verifyLicense = async () => {
    try {
      const storedVerified = localStorage.getItem("license_verified");
      const storedExpires = localStorage.getItem("license_valid_until");
      const now = new Date();

      if (storedVerified === "true" && storedExpires) {
        const expiresOn = new Date(storedExpires);
        if (expiresOn > now) {
          navigate("/login");
          return;
        } else {
          localStorage.removeItem("license_verified");
          localStorage.removeItem("license_valid_until");
        }
      }

      const data = await checkLicenseStatus();
      const expiresOn = data.expires_on ? new Date(data.expires_on) : null;

      if (data.valid && expiresOn && expiresOn > now) {
        localStorage.setItem("license_verified", "true");
        localStorage.setItem("license_valid_until", expiresOn.toISOString());
        navigate("/login");
      } else {
        navigate("/license");
      }
    } catch (error) {
      console.error("License check failed", error);
      navigate("/license");
    }
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&display=swap"
        rel="stylesheet"
      />

      <div
        className="home-container"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div className="hotel-name-banner">
           The Grand Plaza Hotel
        </div>

        <div className="home-card">
          <div className="hems-text">
            <span className="hems-letter">H</span>
            <span className="hems-letter">E</span>
            <span className="hems-letter">M</span>
            <span className="hems-letter">S</span>
          </div>

          <h1 className="heading-line1">Welcome to</h1>
          <h2 className="heading-line2">Hotel & Event Management System</h2>

          <button
            className="proceed-button"
            onClick={verifyLicense}
          >
            Proceed &gt;&gt;
          </button>
        </div>

        <footer className="home-footer">
          <div>Produced & Licensed by School of Accounting Package</div>
          <div>© 2025</div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
